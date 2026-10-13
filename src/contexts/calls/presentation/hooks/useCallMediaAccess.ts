import { useCallback, useEffect, useState } from 'react';

import type { CallMicrophoneRequest } from './CallMicrophoneRequest';

import { CallMicrophoneCapture } from '../../infrastructure/media/CallMicrophoneCapture';
import { logCallWarning } from '../../infrastructure/media/callDebugLogger';
import {
  loadCallMediaEncryptionEnabled,
  loadCallMicrophoneDeviceId,
  loadCallNoiseCancellationEnabled,
  saveCallMediaEncryptionEnabled,
  saveCallNoiseCancellationEnabled,
} from '../../infrastructure/storage/callAudioPreference';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { requestCallMicrophone } from './requestCallMicrophone';

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
  ) => Promise<CallMicrophoneRequest>;
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
  const [noiseCancellationEnabled, setNoiseCancellationEnabled] = useState(() =>
    loadCallNoiseCancellationEnabled(identityId),
  );

  useEffect(() => {
    setMediaEncryptionEnabled(loadCallMediaEncryptionEnabled(identityId));
    setNoiseCancellationEnabled(loadCallNoiseCancellationEnabled(identityId));
  }, [identityId]);

  useEffect(() => {
    saveCallMediaEncryptionEnabled(identityId, mediaEncryptionEnabled);
  }, [identityId, mediaEncryptionEnabled]);

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
