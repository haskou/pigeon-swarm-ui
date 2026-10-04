import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { CallPeerConnections } from '../../infrastructure/media/CallPeerConnections';
import type { LocalCallMedia } from '../../infrastructure/media/LocalCallMedia';
import type { ScreenShareQualityPreset } from '../../infrastructure/media/ScreenShareQualityPreset';
import type { CallSession } from '../view-models/CallSession';

import {
  logCallDebug,
  logCallError,
  logCallWarning,
} from '../../infrastructure/media/callDebugLogger';
import { localMediaSession } from './callSessionMediaState';
import { classifyCallMicrophoneError } from './classifyCallMicrophoneError';

export type CallMediaControls = {
  retryMicrophone: () => Promise<void>;
  setParticipantScreenShareVolume: (
    identityId: string,
    volumePercent: number,
  ) => void;
  setParticipantVolume: (identityId: string, volumePercent: number) => void;
  setScreenShareQuality: (quality: ScreenShareQualityPreset) => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleDeafen: () => void;
  toggleMediaEncryption: () => void;
  toggleMute: () => void;
  toggleNoiseCancellation: (enabled: boolean) => Promise<void>;
  toggleScreenShare: () => Promise<void>;
};

export function useCallMediaControls({
  activeCallRef,
  mediaManager,
  peerManager,
  setActiveCall,
}: {
  activeCallRef: MutableRefObject<CallSession | null>;
  mediaManager: LocalCallMedia;
  peerManager: CallPeerConnections;
  setActiveCall: Dispatch<SetStateAction<CallSession | null>>;
}): CallMediaControls {
  const toggleMute = () => {
    setActiveCall((current) => {
      if (!current) {
        logCallWarning('session:toggle-mute:ignored-no-active-call');

        return current;
      }

      if (!current.hasMicrophone) {
        logCallWarning('session:toggle-mute:ignored-no-microphone', {
          callId: current.id,
          status: current.status,
        });

        return current;
      }

      const muted = !current.muted;

      logCallDebug('session:toggle-mute', {
        callId: current.id,
        muted,
      });
      mediaManager.setMicrophoneMuted(muted);

      return {
        ...current,
        muted,
        participants: current.participants.map((participant, index) =>
          index === 0
            ? { ...participant, muted, speaking: false }
            : participant,
        ),
      };
    });
  };

  const toggleDeafen = () => {
    setActiveCall((current) => {
      if (!current) {
        logCallWarning('session:toggle-deafen:ignored-no-active-call');

        return current;
      }

      const deafened = !current.deafened;

      logCallDebug('session:toggle-deafen', {
        callId: current.id,
        deafened,
      });
      peerManager.setDeafened(deafened);

      return {
        ...current,
        deafened,
        participants: current.participants.map((participant) =>
          participant.identityId === current.currentIdentityId
            ? { ...participant, deafened }
            : participant,
        ),
      };
    });
  };

  const toggleMediaEncryption = () => {
    setActiveCall((current) => {
      if (!current || !current.mediaEncryption.available) return current;

      const enabled = !current.mediaEncryption.enabled;

      peerManager.setMediaEncryptionEnabled(enabled);

      return {
        ...current,
        mediaEncryption: {
          ...current.mediaEncryption,
          active: enabled,
          enabled,
          reason: enabled ? undefined : 'disabled',
        },
      };
    });
  };

  const retryMicrophone = async () => {
    const current = activeCallRef.current;

    if (!current) return;

    try {
      const stream = await mediaManager.startAudio({
        noiseCancellationEnabled: current.noiseCancellationEnabled,
      });

      peerManager.setLocalStream(stream);
      setActiveCall((active) =>
        active?.id === current.id
          ? {
              ...active,
              hasMicrophone: true,
              localPreviewStream: stream,
              microphoneError: undefined,
              muted: false,
              participants: active.participants.map((participant) =>
                participant.identityId === active.currentIdentityId
                  ? { ...participant, mediaStream: stream, muted: false }
                  : participant,
              ),
              status:
                active.status === 'permission-denied' ? 'live' : active.status,
            }
          : active,
      );
    } catch (error) {
      setActiveCall((active) =>
        active?.id === current.id
          ? {
              ...active,
              hasMicrophone: false,
              microphoneError: classifyCallMicrophoneError(error),
              muted: true,
            }
          : active,
      );
    }
  };

  const toggleNoiseCancellation = async (enabled: boolean) => {
    const current = activeCallRef.current;

    if (!current) {
      logCallWarning(
        'session:toggle-noise-cancellation:ignored-no-active-call',
      );

      return;
    }

    if (!current.hasMicrophone) {
      logCallWarning(
        'session:toggle-noise-cancellation:ignored-no-microphone',
        {
          callId: current.id,
          status: current.status,
        },
      );
      setActiveCall((active) =>
        active?.id === current.id
          ? { ...active, noiseCancellationEnabled: enabled }
          : active,
      );

      return;
    }

    try {
      const stream = await mediaManager.setNoiseCancellationEnabled(enabled);

      peerManager.setLocalStream(stream);
      setActiveCall((active) =>
        active?.id === current.id
          ? localMediaSession(active, {
              cameraEnabled: mediaManager.hasCamera(),
              localPreviewStream: stream ?? undefined,
              noiseCancellationEnabled: enabled,
              screenShareAudioEnabled: active.screenShareAudioEnabled,
              screenShareQuality: active.screenShareQuality,
              screenSharing: mediaManager.hasScreenShare(),
              screenStream: mediaManager.screenPreviewStream(),
            })
          : active,
      );
    } catch (error) {
      logCallError('session:toggle-noise-cancellation:failed', error, {
        callId: current.id,
        enabled,
      });

      throw error;
    }
  };

  const toggleCamera = async () => {
    const current = activeCallRef.current;

    if (!current) {
      logCallWarning('session:toggle-camera:ignored-no-active-call');

      return;
    }

    try {
      const cameraEnabled = !current.cameraEnabled;
      const stream = cameraEnabled
        ? await mediaManager.enableCamera()
        : mediaManager.disableCamera();

      peerManager.setLocalStream(stream);
      setActiveCall((active) =>
        active?.id === current.id
          ? localMediaSession(active, {
              cameraEnabled,
              localPreviewStream: stream ?? undefined,
              noiseCancellationEnabled: active.noiseCancellationEnabled,
              screenShareAudioEnabled: active.screenShareAudioEnabled,
              screenShareQuality: active.screenShareQuality,
              screenSharing: mediaManager.hasScreenShare(),
              screenStream: mediaManager.screenPreviewStream(),
            })
          : active,
      );
    } catch (error) {
      logCallError('session:toggle-camera:failed', error, {
        callId: current.id,
      });
    }
  };

  const toggleScreenShare = async () => {
    const current = activeCallRef.current;

    if (!current) {
      logCallWarning('session:toggle-screen-share:ignored-no-active-call');

      return;
    }

    try {
      const screenSharing = !current.screenSharing;
      const stream = screenSharing
        ? await mediaManager.enableScreenShare({
            audioEnabled: true,
            quality: current.screenShareQuality,
          })
        : mediaManager.disableScreenShare();

      peerManager.setLocalStream(stream);
      setActiveCall((active) =>
        active?.id === current.id
          ? localMediaSession(active, {
              cameraEnabled: mediaManager.hasCamera(),
              localPreviewStream: stream ?? undefined,
              noiseCancellationEnabled: active.noiseCancellationEnabled,
              screenShareAudioEnabled: true,
              screenShareQuality: active.screenShareQuality,
              screenSharing,
              screenStream: mediaManager.screenPreviewStream(),
            })
          : active,
      );
    } catch (error) {
      logCallError('session:toggle-screen-share:failed', error, {
        callId: current.id,
      });
    }
  };

  const setParticipantVolume = (identityId: string, volumePercent: number) => {
    peerManager.setPeerVolume(identityId, volumePercent);
    setActiveCall((current) => {
      if (!current) return current;

      return {
        ...current,
        participantVolumes: {
          ...current.participantVolumes,
          [identityId]: volumePercent,
        },
      };
    });
  };

  const setParticipantScreenShareVolume = (
    identityId: string,
    volumePercent: number,
  ) => {
    const current = activeCallRef.current;

    if (current?.currentIdentityId === identityId) {
      mediaManager.setScreenShareAudioVolume(volumePercent);
    } else {
      peerManager.setPeerScreenShareVolume(identityId, volumePercent);
    }

    setActiveCall((current) => {
      if (!current) return current;

      return {
        ...current,
        screenShareVolumes: {
          ...current.screenShareVolumes,
          [identityId]: volumePercent,
        },
      };
    });
  };

  const setScreenShareQuality = async (quality: ScreenShareQualityPreset) => {
    const current = activeCallRef.current;

    if (!current) return;

    peerManager.setScreenShareQuality(quality);

    try {
      const stream = await mediaManager.setScreenShareQuality(quality);

      setActiveCall((active) =>
        active?.id === current.id
          ? localMediaSession(active, {
              cameraEnabled: mediaManager.hasCamera(),
              localPreviewStream: stream ?? undefined,
              noiseCancellationEnabled: active.noiseCancellationEnabled,
              screenShareAudioEnabled: active.screenShareAudioEnabled,
              screenShareQuality: quality,
              screenSharing: mediaManager.hasScreenShare(),
              screenStream: mediaManager.screenPreviewStream(),
            })
          : active,
      );
    } catch (error) {
      logCallError('session:screen-share-quality:failed', error, {
        callId: current.id,
        quality,
      });
      setActiveCall((active) =>
        active?.id === current.id
          ? { ...active, screenShareQuality: quality }
          : active,
      );
    }
  };

  return {
    retryMicrophone,
    setParticipantScreenShareVolume,
    setParticipantVolume,
    setScreenShareQuality,
    toggleCamera,
    toggleDeafen,
    toggleMediaEncryption,
    toggleMute,
    toggleNoiseCancellation,
    toggleScreenShare,
  };
}
