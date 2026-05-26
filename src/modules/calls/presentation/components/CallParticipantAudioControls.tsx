import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { MicrophoneIcon, SpeakerIcon } from './callIcons';
import { CallVolumeControl } from './CallVolumeControl';
import { ScreenShareVolumeControl } from './ScreenShareVolumeControl';

export function CallParticipantAudioControls({
  hasMicrophone,
  hasScreenShare,
  isCurrentIdentity,
  muted,
  onScreenShareVolumeChange,
  onToggleMute,
  onVoiceVolumeChange,
  screenShareVolumePercent,
  variant,
  voiceVolumePercent,
}: {
  hasMicrophone: boolean;
  hasScreenShare: boolean;
  isCurrentIdentity: boolean;
  muted: boolean;
  onScreenShareVolumeChange: (nextVolume: number) => void;
  onToggleMute: () => void;
  onVoiceVolumeChange: (nextVolume: number) => void;
  screenShareVolumePercent: number;
  variant: 'grid' | 'strip';
  voiceVolumePercent: number;
}) {
  return (
    <>
      <div
        className={cx(
          'flex w-full items-center gap-2 rounded-2xl border border-white/8 bg-white/6 p-2 text-left',
          variant === 'strip' ? 'mt-3' : 'mt-5',
        )}
      >
        <button
          type="button"
          onClick={onToggleMute}
          disabled={isCurrentIdentity && !hasMicrophone}
          className={cx(
            'grid h-9 w-9 shrink-0 place-items-center rounded-2xl font-black transition',
            muted
              ? 'bg-fuchsia-500/25 text-fuchsia-100 hover:bg-fuchsia-500/35'
              : 'bg-white/10 text-white/65 hover:bg-white/15 hover:text-white',
            isCurrentIdentity &&
              !hasMicrophone &&
              'cursor-not-allowed opacity-40',
          )}
        >
          <MicrophoneIcon muted={muted} />
        </button>
        <CallVolumeControl
          disabled={isCurrentIdentity}
          icon={<SpeakerIcon />}
          label={copy.calls.volume}
          onChange={onVoiceVolumeChange}
          value={voiceVolumePercent}
        />
      </div>
      {!isCurrentIdentity && hasScreenShare && (
        <ScreenShareVolumeControl
          placement="inline"
          onChange={onScreenShareVolumeChange}
          value={screenShareVolumePercent}
        />
      )}
    </>
  );
}
