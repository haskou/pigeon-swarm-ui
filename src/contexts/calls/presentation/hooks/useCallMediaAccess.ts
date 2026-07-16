import { useCallback, useEffect, useState } from 'react';

import { CallMicrophoneCapture } from '../../infrastructure/media/CallMicrophoneCapture';
import { logCallWarning } from '../../infrastructure/media/callDebugLogger';
import {
  loadCallMediaEncryptionEnabled,
  loadCallNoiseCancellationEnabled,
  saveCallMediaEncryptionEnabled,
  saveCallNoiseCancellationEnabled,
} from '../../infrastructure/storage/callAudioPreference';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';

type CallMediaAccessInput = {
  identityId: string;
  onError: (message: string) => void;
  toggleMediaEncryption: () => void;
  toggleNoiseCancellation: (enabled: boolean) => Promise<void>;
};

type CallMediaAccess = {
  mediaEncryptionEnabled: boolean;
  noiseCancellationEnabled: boolean;
  requestOptionalLocalAudio: (
    event: string,
    context: Record<string, unknown>,
  ) => Promise<MediaStream | null>;
  stopLocalAudio: (stream: MediaStream | null) => void;
  toggleCallMediaEncryption: () => void;
  toggleCallNoiseCancellation: () => void;
};

export function useCallMediaAccess({
  identityId,
  onError,
  toggleMediaEncryption,
  toggleNoiseCancellation,
}: CallMediaAccessInput): CallMediaAccess {
  const [mediaEncryptionEnabled, setMediaEncryptionEnabled] = useState(() =>
    loadCallMediaEncryptionEnabled(identityId),
  );
  const [noiseCancellationEnabled, setNoiseCancellationEnabled] = useState(
    () => loadCallNoiseCancellationEnabled(identityId),
  );

  useEffect(() => {
    setMediaEncryptionEnabled(loadCallMediaEncryptionEnabled(identityId));
    setNoiseCancellationEnabled(
      loadCallNoiseCancellationEnabled(identityId),
    );
  }, [identityId]);

  useEffect(() => {
    saveCallMediaEncryptionEnabled(identityId, mediaEncryptionEnabled);
  }, [identityId, mediaEncryptionEnabled]);

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

  const toggleCallMediaEncryption = useCallback(() => {
    setMediaEncryptionEnabled((enabled) => !enabled);
    toggleMediaEncryption();
  }, [toggleMediaEncryption]);

  return {
    mediaEncryptionEnabled,
    noiseCancellationEnabled,
    requestOptionalLocalAudio,
    stopLocalAudio: CallMicrophoneCapture.stop,
    toggleCallMediaEncryption,
    toggleCallNoiseCancellation,
  };
}
