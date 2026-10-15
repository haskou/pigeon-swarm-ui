import { useCallback, useEffect, useState } from 'react';

import type { CallMicrophoneRequest } from './CallMicrophoneRequest';

import { CallMicrophoneCapture } from '../../infrastructure/media/CallMicrophoneCapture';
import { logCallWarning } from '../../infrastructure/media/callDebugLogger';
import {
  loadCallMicrophoneDeviceId,
  loadCallNoiseCancellationEnabled,
  saveCallNoiseCancellationEnabled,
} from '../../infrastructure/storage/callAudioPreference';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { requestCallMicrophone } from './requestCallMicrophone';

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
  ) => Promise<CallMicrophoneRequest>;
  stopLocalAudio: (stream: MediaStream | null) => void;
  toggleCallNoiseCancellation: () => void;
};

export function useCallMediaAccess({
  identityId,
  onError,
  toggleNoiseCancellation,
}: CallMediaAccessInput): CallMediaAccess {
  const [noiseCancellationEnabled, setNoiseCancellationEnabled] = useState(() =>
    loadCallNoiseCancellationEnabled(identityId),
  );

  useEffect(() => {
    setNoiseCancellationEnabled(loadCallNoiseCancellationEnabled(identityId));
  }, [identityId]);

  useEffect(() => {
    saveCallNoiseCancellationEnabled(identityId, noiseCancellationEnabled);
  }, [identityId, noiseCancellationEnabled]);

  const requestOptionalLocalAudio = useCallback(
    async (
      event: string,
      context: Record<string, unknown>,
    ): Promise<CallMicrophoneRequest> => {
      const request = await requestCallMicrophone({
        deviceId: loadCallMicrophoneDeviceId(identityId),
        noiseCancellationEnabled,
      });

      if (request.microphoneError) {
        logCallWarning(event, {
          ...context,
          microphoneError: request.microphoneError,
        });
      }

      return request;
    },
    [identityId, noiseCancellationEnabled],
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
