import { useCallback, useEffect, useState } from 'react';

import { CallMicrophoneCapture } from '../../infrastructure/media/CallMicrophoneCapture';
import { logCallWarning } from '../../infrastructure/media/callDebugLogger';
import {
  loadCallNoiseCancellationEnabled,
  saveCallNoiseCancellationEnabled,
} from '../../infrastructure/storage/callAudioPreference';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';

type CallMediaAccessInput = {
  identityId: string;
  onError: (message: string) => void;
  toggleNoiseCancellation: (enabled: boolean) => Promise<void>;
};

type CallMediaAccess = {
  noiseCancellationEnabled: boolean;
  requestOptionalLocalAudio: (
    event: string,
    context: Record<string, unknown>,
  ) => Promise<MediaStream | null>;
  stopLocalAudio: (stream: MediaStream | null) => void;
  toggleCallNoiseCancellation: () => void;
};

export function useCallMediaAccess({
  identityId,
  onError,
  toggleNoiseCancellation,
}: CallMediaAccessInput): CallMediaAccess {
  const [noiseCancellationEnabled, setNoiseCancellationEnabled] = useState(
    () => loadCallNoiseCancellationEnabled(identityId),
  );

  useEffect(() => {
    setNoiseCancellationEnabled(
      loadCallNoiseCancellationEnabled(identityId),
    );
  }, [identityId]);

  useEffect(() => {
    saveCallNoiseCancellationEnabled(identityId, noiseCancellationEnabled);
  }, [identityId, noiseCancellationEnabled]);

  const requestLocalAudio = useCallback(async (): Promise<MediaStream> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(copy.calls.microphoneUnavailable);
    }

    try {
      return await CallMicrophoneCapture.capture(navigator.mediaDevices, {
        noiseCancellationEnabled,
      });
    } catch {
      throw new Error(copy.calls.microphoneUnavailable);
    }
  }, [noiseCancellationEnabled]);

  const requestOptionalLocalAudio = useCallback(
    async (
      event: string,
      context: Record<string, unknown>,
    ): Promise<MediaStream | null> =>
      await requestLocalAudio().catch((caught): null => {
        logCallWarning(event, { ...context, error: caught });

        return null;
      }),
    [requestLocalAudio],
  );

  const toggleCallNoiseCancellation = useCallback(() => {
    const enabled = !noiseCancellationEnabled;

    setNoiseCancellationEnabled(enabled);
    void toggleNoiseCancellation(enabled).catch((caught) => {
      setNoiseCancellationEnabled(!enabled);
      onError(toUserErrorMessage(caught, copy.workspace.sendError));
    });
  }, [noiseCancellationEnabled, onError, toggleNoiseCancellation]);

  return {
    noiseCancellationEnabled,
    requestOptionalLocalAudio,
    stopLocalAudio: CallMicrophoneCapture.stop,
    toggleCallNoiseCancellation,
  };
}
