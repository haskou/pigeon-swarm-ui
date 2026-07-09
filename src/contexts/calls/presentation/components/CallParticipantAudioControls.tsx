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
  showScreenShareVolume = true,
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
  showScreenShareVolume?: boolean;
  variant: 'grid' | 'strip';
  voiceVolumePercent: number;
}) {
  return (
    <>
      <div
        className={cx(
          'flex w-full items-center gap-1.5 border-y border-white/10 py-2 text-left sm:gap-2',
          variant === 'strip' ? 'mt-2 sm:mt-3' : 'mt-5',
        )}
      >
        <button
          type="button"
          onClick={onToggleMute}
          disabled={isCurrentIdentity && !hasMicrophone}
          className={cx(
            'grid h-8 w-8 shrink-0 place-items-center rounded-xl font-black transition sm:h-9 sm:w-9 sm:rounded-2xl',
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
      {showScreenShareVolume && !isCurrentIdentity && hasScreenShare && (
        <ScreenShareVolumeControl
          placement="inline"
          onChange={onScreenShareVolumeChange}
          value={screenShareVolumePercent}
        />
      )}
    </>
  );
}
