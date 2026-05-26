import type { CallSession } from '../../domain/callSession.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { CallButton } from './CallButton';
import {
  CameraIcon,
  HangUpIcon,
  HeadphonesIcon,
  MicrophoneIcon,
  NoiseCancellationIcon,
  ScreenSoundIcon,
  ScreenShareIcon,
} from './callIcons';

export function CallStageFooter({
  call,
  onEnd,
  onToggleCamera,
  onToggleDeafen,
  onToggleMute,
  onToggleNoiseCancellation,
  onToggleScreenShareAudio,
  onToggleScreenShare,
}: {
  call: CallSession;
  onEnd: () => void;
  onToggleCamera: () => void;
  onToggleDeafen: () => void;
  onToggleMute: () => void;
  onToggleNoiseCancellation: () => void;
  onToggleScreenShareAudio: () => void;
  onToggleScreenShare: () => void;
}) {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 p-4">
      <CallButton
        active={call.cameraEnabled}
        label={
          call.cameraEnabled ? copy.calls.disableCamera : copy.calls.camera
        }
        onClick={onToggleCamera}
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
        onClick={onToggleScreenShare}
      >
        <ScreenShareIcon active={call.screenSharing} />
      </CallButton>
      {call.screenSharing && (
        <ScreenShareAudioToggle
          active={call.screenShareAudioEnabled}
          onToggle={onToggleScreenShareAudio}
        />
      )}
      <CallButton
        active={call.muted}
        disabled={!call.hasMicrophone}
        label={call.muted ? copy.calls.unmute : copy.calls.mute}
        onClick={onToggleMute}
      >
        <MicrophoneIcon muted={call.muted} />
      </CallButton>
      <CallButton
        active={call.deafened}
        label={call.deafened ? copy.calls.undeafen : copy.calls.deafen}
        onClick={onToggleDeafen}
      >
        <HeadphonesIcon deafened={call.deafened} />
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
        onClick={onToggleNoiseCancellation}
      >
        <NoiseCancellationIcon active={call.noiseCancellationEnabled} />
      </CallButton>
      <button
        type="button"
        onClick={onEnd}
        className="grid h-12 w-12 place-items-center rounded-[1.15rem] border border-rose-200/40 bg-rose-500 text-white shadow-lg shadow-rose-950/30 ring-2 ring-rose-500/20 transition hover:bg-rose-400 hover:ring-rose-300/35 [&>svg]:h-6 [&>svg]:w-6"
        aria-label={copy.calls.leave}
        title={copy.calls.leave}
      >
        <HangUpIcon />
      </button>
    </footer>
  );
}

function ScreenShareAudioToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cx(
        'flex h-12 items-center gap-2.5 rounded-[1.15rem] px-3.5 text-xs font-black transition [&>svg]:h-6 [&>svg]:w-6',
        active
          ? 'bg-emerald-300 text-slate-950 hover:bg-emerald-200'
          : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white',
      )}
      aria-pressed={active}
      aria-label={
        active ? copy.calls.stopScreenSound : copy.calls.shareScreenSound
      }
      title={active ? copy.calls.stopScreenSound : copy.calls.shareScreenSound}
    >
      <ScreenSoundIcon active={active} />
      <span>{copy.calls.screenSound}</span>
    </button>
  );
}
