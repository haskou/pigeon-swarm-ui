import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { CallSession } from '../../domain/calls/CallSession';

import { copy } from '../../i18n/en';
import { dialingCallSoundUrl, playAnsweredCallSound } from '../../utils/sounds';
import { CallButton } from './CallControlButton';
import {
  CameraIcon,
  HangUpIcon,
  HeadphonesIcon,
  MicrophoneIcon,
  ScreenShareIcon,
  SpeakerIcon,
} from './CallIcons';
import { CallStageDialog } from './CallStageDialog';
import { VideoPreview } from './VideoPreview';

interface GlobalCallBarProps {
  call: CallSession;
  onEnd: () => void;
  onParticipantVolumeChange: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onToggleCamera: () => void;
  onToggleDeafen: () => void;
  onToggleMute: () => void;
  onToggleScreenShare: () => void;
}

export function GlobalCallBar({
  call,
  onEnd,
  onParticipantVolumeChange,
  onToggleCamera,
  onToggleDeafen,
  onToggleMute,
  onToggleScreenShare,
}: GlobalCallBarProps) {
  const [stageOpen, setStageOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const subtitle =
    call.subtitle ||
    call.participants.map((participant) => participant.name).join(', ');
  const screenParticipant = call.participants.find(
    (participant) => participant.screenSharing && participant.screenStream,
  );

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
        onToggleScreenShare={onToggleScreenShare}
        screenParticipant={screenParticipant}
        subtitle={subtitle}
      />
      {stageOpen &&
        createPortal(
          <CallStageDialog
            call={call}
            dataOpen={dataOpen}
            onClose={() => setStageOpen(false)}
            onDataToggle={() => setDataOpen((isOpen) => !isOpen)}
            onEnd={onEnd}
            onParticipantVolumeChange={onParticipantVolumeChange}
            onToggleCamera={onToggleCamera}
            onToggleDeafen={onToggleDeafen}
            onToggleMute={onToggleMute}
            onToggleScreenShare={onToggleScreenShare}
            subtitle={subtitle}
          />,
          document.body,
        )}
    </>
  );
}

function CompactCallBar({
  call,
  onEnd,
  onOpenStage,
  onToggleCamera,
  onToggleDeafen,
  onToggleMute,
  onToggleScreenShare,
  screenParticipant,
  subtitle,
}: {
  call: CallSession;
  onEnd: () => void;
  onOpenStage: () => void;
  onToggleCamera: () => void;
  onToggleDeafen: () => void;
  onToggleMute: () => void;
  onToggleScreenShare: () => void;
  screenParticipant?: CallSession['participants'][number];
  subtitle: string;
}) {
  return (
    <aside
      role="button"
      tabIndex={0}
      onClick={onOpenStage}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpenStage();
      }}
      className="mb-2 cursor-pointer rounded-2xl border border-white/10 bg-[#151722]/95 p-2.5 shadow-xl shadow-black/35 backdrop-blur-xl transition hover:bg-[#191b29]/95"
    >
      <div className="flex flex-col gap-2.5">
        {screenParticipant?.screenStream && (
          <CompactScreenPreview participant={screenParticipant} />
        )}
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-200">
            <SpeakerIcon />
          </div>
          <CompactCallTitle call={call} subtitle={subtitle} />
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <CompactMediaControls
            call={call}
            onToggleCamera={onToggleCamera}
            onToggleDeafen={onToggleDeafen}
            onToggleMute={onToggleMute}
            onToggleScreenShare={onToggleScreenShare}
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEnd();
            }}
            className="grid h-9 w-9 place-items-center rounded-2xl border border-rose-200/40 bg-rose-500 text-white shadow-lg shadow-rose-950/30 ring-2 ring-rose-500/20 transition hover:bg-rose-400 hover:ring-rose-300/35"
            aria-label={copy.calls.leave}
            title={copy.calls.leave}
          >
            <HangUpIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}

function CompactScreenPreview({
  participant,
}: {
  participant: CallSession['participants'][number];
}) {
  const stream = participant.screenStream;
  const label = `${copy.calls.screen} ${participant.name}`;

  if (!stream) return null;

  return (
    <div className="relative h-20 overflow-hidden rounded-xl border border-emerald-300/25 bg-black">
      <VideoPreview label={label} muted stream={stream} />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 py-1">
        <p className="truncate text-[0.65rem] font-black text-emerald-100">
          {participant.name}
        </p>
      </div>
    </div>
  );
}

function CompactCallTitle({
  call,
  subtitle,
}: {
  call: CallSession;
  subtitle: string;
}) {
  const statusText =
    call.status === 'permission-denied'
      ? copy.calls.microphoneUnavailable
      : subtitle || copy.calls.waitingForParticipants;

  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate text-sm font-black text-white">{call.title}</h2>
      </div>
      <p className="mt-0.5 truncate text-[0.7rem] text-white/45">
        {statusText}
      </p>
      {!call.hasMicrophone && (
        <p className="mt-1 truncate text-[0.68rem] font-bold text-amber-200/85">
          {copy.calls.microphoneUnavailable}
        </p>
      )}
    </div>
  );
}

function CompactMediaControls({
  call,
  onToggleCamera,
  onToggleDeafen,
  onToggleMute,
  onToggleScreenShare,
}: {
  call: CallSession;
  onToggleCamera: () => void;
  onToggleDeafen: () => void;
  onToggleMute: () => void;
  onToggleScreenShare: () => void;
}) {
  return (
    <>
      <CallButton
        active={call.cameraEnabled}
        label={
          call.cameraEnabled ? copy.calls.disableCamera : copy.calls.camera
        }
        onClick={(event) => {
          event.stopPropagation();
          onToggleCamera();
        }}
      >
        <CameraIcon active={call.cameraEnabled} />
      </CallButton>
      <CallButton
        active={call.screenSharing}
        label={
          call.screenSharing
            ? copy.calls.stopScreenShare
            : copy.calls.shareScreen
        }
        onClick={(event) => {
          event.stopPropagation();
          onToggleScreenShare();
        }}
      >
        <ScreenShareIcon active={call.screenSharing} />
      </CallButton>
      <CallButton
        active={call.muted}
        disabled={!call.hasMicrophone}
        label={call.muted ? copy.calls.unmute : copy.calls.mute}
        onClick={(event) => {
          event.stopPropagation();
          onToggleMute();
        }}
      >
        <MicrophoneIcon muted={call.muted} />
      </CallButton>
      <CallButton
        active={call.deafened}
        label={call.deafened ? copy.calls.undeafen : copy.calls.deafen}
        onClick={(event) => {
          event.stopPropagation();
          onToggleDeafen();
        }}
      >
        <HeadphonesIcon deafened={call.deafened} />
      </CallButton>
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
