import { memo } from 'react';
import type { CallSession } from '../view-models/CallSession';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { CallButton } from './CallButton';
import {
  CameraIcon,
  HangUpIcon,
  HeadphonesIcon,
  MicrophoneIcon,
  NoiseCancellationIcon,
  ScreenShareIcon,
  SpeakerIcon,
} from './callIcons';
import { VideoPreview } from './VideoPreview';
import { callSessionTitle } from './callSessionDisplay';
import { MicrophoneBlockedNotice } from './MicrophoneBlockedNotice';

type CompactCallBarProps = {
  call: CallSession;
  onEnd: () => void;
  onOpenStage: () => void;
  onToggleCamera: () => void;
  onToggleDeafen: () => void;
  onToggleMute: () => void;
  onToggleNoiseCancellation: () => void;
  onRetryMicrophone: () => void;
  onToggleScreenShare: () => void;
  screenParticipant?: CallSession['participants'][number];
  subtitle: string;
};

export const CompactCallBar = memo(function CompactCallBar({
  call,
  onEnd,
  onOpenStage,
  onToggleCamera,
  onToggleDeafen,
  onToggleMute,
  onToggleNoiseCancellation,
  onRetryMicrophone,
  onToggleScreenShare,
  screenParticipant,
  subtitle,
}: CompactCallBarProps) {
  return (
    <aside
      role="button"
      data-testid="compact-call-bar"
      tabIndex={0}
      onClick={onOpenStage}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpenStage();
      }}
      className="mb-2 cursor-pointer rounded-lg border border-white/10 bg-[#151722] p-2.5 shadow-xl shadow-black/35 transition hover:bg-[#191b29]"
    >
      <div className="flex flex-col gap-2.5">
        {screenParticipant?.screenStream && (
          <CompactScreenPreview participant={screenParticipant} />
        )}
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-400/15 text-emerald-200">
            <SpeakerIcon />
          </div>
          <CompactCallTitle call={call} subtitle={subtitle} />
        </div>
        {!call.hasMicrophone && (
          <MicrophoneBlockedNotice
            call={call}
            compact
            onRetryMicrophone={onRetryMicrophone}
          />
        )}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <CompactMediaControls
            call={call}
            onToggleCamera={onToggleCamera}
            onToggleDeafen={onToggleDeafen}
            onToggleMute={onToggleMute}
            onToggleNoiseCancellation={onToggleNoiseCancellation}
            onToggleScreenShare={onToggleScreenShare}
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEnd();
            }}
            className="grid h-9 w-9 place-items-center rounded-lg border border-rose-200/40 bg-rose-500 text-white shadow-lg shadow-rose-950/30 ring-2 ring-rose-500/20 transition hover:bg-rose-400 hover:ring-rose-300/35"
            aria-label={copy.calls.leave}
            title={copy.calls.leave}
          >
            <HangUpIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}, areCompactCallBarPropsEqual);

function areCompactCallBarPropsEqual(
  previous: CompactCallBarProps,
  next: CompactCallBarProps,
): boolean {
  return (
    previous.call.cameraEnabled === next.call.cameraEnabled &&
    previous.call.deafened === next.call.deafened &&
    previous.call.hasMicrophone === next.call.hasMicrophone &&
    previous.call.id === next.call.id &&
    previous.call.muted === next.call.muted &&
    previous.call.noiseCancellationEnabled ===
      next.call.noiseCancellationEnabled &&
    previous.call.screenShareAudioEnabled ===
      next.call.screenShareAudioEnabled &&
    previous.call.screenSharing === next.call.screenSharing &&
    previous.call.status === next.call.status &&
    previous.call.subtitle === next.call.subtitle &&
    previous.call.title === next.call.title &&
    previous.screenParticipant?.identityId ===
      next.screenParticipant?.identityId &&
    previous.screenParticipant?.screenStream ===
      next.screenParticipant?.screenStream &&
    previous.subtitle === next.subtitle
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
      <VideoPreview fit="contain" label={label} muted stream={stream} />
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
  const title = callSessionTitle(call);
  const statusText =
    call.status === 'permission-denied'
      ? copy.calls.microphoneUnavailable
      : subtitle || copy.calls.waitingForParticipants;

  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate text-sm font-black text-white">{title}</h2>
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
  onToggleNoiseCancellation,
  onToggleScreenShare,
}: {
  call: CallSession;
  onToggleCamera: () => void;
  onToggleDeafen: () => void;
  onToggleMute: () => void;
  onToggleNoiseCancellation: () => void;
  onToggleScreenShare: () => void;
}) {
  return (
    <>
      <CallButton
        active={call.muted}
        blocked={!call.hasMicrophone}
        disabled={!call.hasMicrophone}
        label={call.muted ? copy.calls.unmute : copy.calls.mute}
        onClick={(event) => {
          event.stopPropagation();
          onToggleMute();
        }}
      >
        <MicrophoneIcon muted={call.muted || !call.hasMicrophone} />
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
        active={call.noiseCancellationEnabled}
        badge={copy.calls.noiseCancellationBadge}
        disabled={!call.hasMicrophone}
        label={
          call.noiseCancellationEnabled
            ? copy.calls.noiseCancellationOff
            : copy.calls.noiseCancellationOn
        }
        onClick={(event) => {
          event.stopPropagation();
          onToggleNoiseCancellation();
        }}
      >
        <NoiseCancellationIcon active={call.noiseCancellationEnabled} />
      </CallButton>
    </>
  );
}
