import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { CallSession } from '../../domain/callSession.types';

import {
  dialingCallSoundUrl,
  playAnsweredCallSound,
} from '../../../../shared/presentation/sounds';
import { callParticipantHasActiveScreenShare } from './callParticipantHasActiveScreenShare';
import { callSessionSubtitle } from './callSessionDisplay';
import { CompactCallBar } from './CompactCallBar';

const CallStageDialog = lazy(() =>
  import('./CallStageDialog').then((module) => ({
    default: module.CallStageDialog,
  })),
);

interface GlobalCallBarProps {
  call: CallSession;
  onEnd: () => void;
  onParticipantVolumeChange: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onParticipantScreenShareVolumeChange: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onToggleCamera: () => void;
  onToggleDeafen: () => void;
  onToggleMute: () => void;
  onToggleNoiseCancellation: () => void;
  onToggleScreenShareAudio: () => void;
  onToggleScreenShare: () => void;
}

export function GlobalCallBar({
  call,
  onEnd,
  onParticipantScreenShareVolumeChange,
  onParticipantVolumeChange,
  onToggleCamera,
  onToggleDeafen,
  onToggleMute,
  onToggleNoiseCancellation,
  onToggleScreenShareAudio,
  onToggleScreenShare,
}: GlobalCallBarProps) {
  const [stageOpen, setStageOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const subtitle = callSessionSubtitle(call);
  const screenParticipant =
    call.participants.find(
      (participant) =>
        participant.identityId !== call.currentIdentityId &&
        callParticipantHasActiveScreenShare(participant),
    ) ?? call.participants.find(callParticipantHasActiveScreenShare);

  useRingingAudio(call);
  useJoinedParticipantSound(call);

  return (
    <>
      <CompactCallBar
        call={call}
        onEnd={onEnd}
        onOpenStage={() => setStageOpen(true)}
        onToggleCamera={onToggleCamera}
        onToggleDeafen={onToggleDeafen}
        onToggleMute={onToggleMute}
        onToggleNoiseCancellation={onToggleNoiseCancellation}
        onToggleScreenShare={onToggleScreenShare}
        screenParticipant={screenParticipant}
        subtitle={subtitle}
      />
      {stageOpen &&
        createPortal(
          <Suspense fallback={null}>
            <CallStageDialog
              call={call}
              dataOpen={dataOpen}
              onClose={() => setStageOpen(false)}
              onDataToggle={() => setDataOpen((isOpen) => !isOpen)}
              onEnd={onEnd}
              onParticipantScreenShareVolumeChange={
                onParticipantScreenShareVolumeChange
              }
              onParticipantVolumeChange={onParticipantVolumeChange}
              onToggleCamera={onToggleCamera}
              onToggleDeafen={onToggleDeafen}
              onToggleMute={onToggleMute}
              onToggleNoiseCancellation={onToggleNoiseCancellation}
              onToggleScreenShareAudio={onToggleScreenShareAudio}
              onToggleScreenShare={onToggleScreenShare}
              subtitle={subtitle}
            />
          </Suspense>,
          document.body,
        )}
    </>
  );
}

function useRingingAudio(call: CallSession): void {
  const ringingParticipantCount = useMemo(
    () =>
      call.call?.participants.filter(
        (participant) => participant.status === 'ringing',
      ).length ?? 0,
    [call.call?.participants],
  );

  useEffect(() => {
    if (
      call.kind === 'community-voice' ||
      ringingParticipantCount === 0 ||
      call.status === 'permission-denied'
    ) {
      return undefined;
    }

    const audio = new Audio(dialingCallSoundUrl);

    audio.loop = true;
    audio.volume = 0.35;
    void audio.play().catch(() => undefined);

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [call.kind, call.status, ringingParticipantCount]);
}

function useJoinedParticipantSound(call: CallSession): void {
  const joinedParticipantCount = useMemo(
    () =>
      call.call?.participants.filter(
        (participant) => participant.status === 'joined',
      ).length ?? 0,
    [call.call?.participants],
  );
  const previousJoinedParticipantCountRef = useRef(joinedParticipantCount);

  useEffect(() => {
    const previousJoinedParticipantCount =
      previousJoinedParticipantCountRef.current;

    if (joinedParticipantCount > previousJoinedParticipantCount) {
      playAnsweredCallSound();
    }

    previousJoinedParticipantCountRef.current = joinedParticipantCount;
  }, [joinedParticipantCount]);
}
