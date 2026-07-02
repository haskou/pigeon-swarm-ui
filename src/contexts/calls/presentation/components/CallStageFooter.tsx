import type { CallSession } from '../../domain/callSession.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { CallButton } from './CallButton';
import {
  CameraIcon,
  HangUpIcon,
  HeadphonesIcon,
  LockIcon,
  MicrophoneIcon,
  NoiseCancellationIcon,
  ScreenShareIcon,
} from './callIcons';

export function CallStageFooter({
  call,
  onEnd,
  onToggleCamera,
  onToggleDeafen,
  onToggleMute,
  onToggleMediaEncryption,
  onToggleNoiseCancellation,
  onToggleScreenShare,
}: {
  call: CallSession;
  onEnd: () => void;
  onToggleCamera: () => void;
  onToggleDeafen: () => void;
  onToggleMute: () => void;
  onToggleMediaEncryption: () => void;
  onToggleNoiseCancellation: () => void;
  onToggleScreenShare: () => void;
}) {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 p-2.5 sm:gap-3 sm:p-4">
      <CallButton
        active={call.muted}
        blocked={!call.hasMicrophone}
        disabled={!call.hasMicrophone}
        label={call.muted ? copy.calls.unmute : copy.calls.mute}
        onClick={onToggleMute}
      >
        <MicrophoneIcon muted={call.muted || !call.hasMicrophone} />
      </CallButton>
      <CallButton
        active={call.deafened}
        label={call.deafened ? copy.calls.undeafen : copy.calls.deafen}
        onClick={onToggleDeafen}
      >
        <HeadphonesIcon deafened={call.deafened} />
      </CallButton>
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
      <CallButton
        active={call.mediaEncryption.active}
        blocked={!call.mediaEncryption.available}
        disabled={!call.mediaEncryption.available}
        label={
          call.mediaEncryption.active
            ? copy.calls.mediaEncryptionOff
            : copy.calls.mediaEncryptionOn
        }
        onClick={onToggleMediaEncryption}
      >
        <LockIcon active={call.mediaEncryption.active} />
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
        className="grid h-10 w-10 place-items-center rounded-xl border border-rose-200/40 bg-rose-500 text-white shadow-lg shadow-rose-950/30 ring-2 ring-rose-500/20 transition hover:bg-rose-400 hover:ring-rose-300/35 sm:h-12 sm:w-12 sm:rounded-[1.15rem] [&>svg]:h-5 [&>svg]:w-5 sm:[&>svg]:h-6 sm:[&>svg]:w-6"
        aria-label={copy.calls.leave}
        title={copy.calls.leave}
      >
        <HangUpIcon />
      </button>
    </footer>
  );
}
