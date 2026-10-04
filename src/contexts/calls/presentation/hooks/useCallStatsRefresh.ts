import { type Dispatch, type SetStateAction, useEffect } from 'react';

import type { CallPeerConnections } from '../../infrastructure/media/CallPeerConnections';
import type { PeerMediaStats } from '../../infrastructure/media/CallPeerConnections';
import type { LocalCallMedia } from '../../infrastructure/media/LocalCallMedia';
import type { CallSession } from '../view-models/CallSession';

import {
  callParticipantsMediaStateEqual,
  localMediaFlagsChanged,
  participantsWithMediaState,
} from './callSessionMediaState';

const REFRESH_INTERVAL_MS = 500;

export function useCallStatsRefresh({
  activeCallId,
  mediaManager,
  peerManager,
  setActiveCall,
}: {
  activeCallId: string | undefined;
  mediaManager: LocalCallMedia;
  peerManager: CallPeerConnections;
  setActiveCall: Dispatch<SetStateAction<CallSession | null>>;
}): void {
  useEffect(() => {
    if (!activeCallId) return undefined;

    let cancelled = false;
    let refreshInFlight = false;

    const refreshStats = async () => {
      if (refreshInFlight) return;

      refreshInFlight = true;
      const stats = await peerManager
        .collectStats()
        .catch((): Record<string, PeerMediaStats> => ({}));
      const remoteStreams = peerManager.remoteMediaStreams();
      const remoteScreenStreams = peerManager.remoteScreenMediaStreams();
      const localAudioLevel = mediaManager.localAudioLevel();
      const screenStream = mediaManager.screenPreviewStream();

      refreshInFlight = false;

      if (cancelled) return;

      setActiveCall((current) => {
        if (!current) return current;

        const nextParticipants = participantsWithMediaState(
          current,
          stats,
          remoteStreams,
          remoteScreenStreams,
          localAudioLevel,
          (identityId) => peerManager.isMediaEncryptionActiveWith(identityId),
          screenStream,
        );
        const nextCameraEnabled = mediaManager.hasCamera();
        const nextLocalPreviewStream = mediaManager.previewStream();
        const nextScreenSharing = mediaManager.hasScreenShare();

        if (
          localMediaFlagsChanged(current, nextCameraEnabled, nextScreenSharing)
        ) {
          peerManager.setLocalStream(nextLocalPreviewStream ?? null);
        }

        if (
          current.cameraEnabled === nextCameraEnabled &&
          current.localPreviewStream === nextLocalPreviewStream &&
          current.screenSharing === nextScreenSharing &&
          callParticipantsMediaStateEqual(
            current.participants,
            nextParticipants,
          )
        ) {
          return current;
        }

        return {
          ...current,
          cameraEnabled: nextCameraEnabled,
          localPreviewStream: nextLocalPreviewStream,
          participants: nextParticipants,
          screenSharing: nextScreenSharing,
        };
      });
    };

    void refreshStats();
    const interval = window.setInterval(() => {
      void refreshStats();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeCallId, mediaManager, peerManager, setActiveCall]);
}
