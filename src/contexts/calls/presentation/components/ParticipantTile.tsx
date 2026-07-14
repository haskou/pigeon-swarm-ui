import type { CallSession } from '../../domain/callSession.types';

import { cx } from '../../../../shared/presentation/cx';
import { shortId } from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { CallParticipantAudioControls } from './CallParticipantAudioControls';
import { callParticipantHasActiveScreenShare } from './callParticipantHasActiveScreenShare';
import { callParticipantDisplayName } from './callParticipantDisplayName';
import { LockIcon } from './callIcons';
import { CallParticipantMedia } from './CallParticipantMedia';
import { CallParticipantMetrics } from './CallParticipantMetrics';

export function ParticipantTile({
  call,
  onExpandScreen,
  onParticipantScreenShareVolumeChange,
  onParticipantVolumeChange,
  onToggleMute,
  participant,
  variant = 'grid',
}: {
  call: CallSession;
  onExpandScreen?: (participant: CallSession['participants'][number]) => void;
  onParticipantScreenShareVolumeChange?: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onParticipantVolumeChange: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onToggleMute: () => void;
  participant: CallSession['participants'][number];
  variant?: 'grid' | 'strip';
}) {
  const isCurrentIdentity = participant.identityId === call.currentIdentityId;
  const volumePercent = isCurrentIdentity
    ? 100
    : (call.participantVolumes[participant.identityId] ?? 100);
  const screenShareVolumePercent = isCurrentIdentity
    ? 100
    : (call.screenShareVolumes[participant.identityId] ?? 100);
  const participantName = callParticipantDisplayName(participant);
  const participantSubtitle = participantTileSubtitle(participant);
  const hasActiveScreenShare = callParticipantHasActiveScreenShare(participant);
  const hasVisualMedia =
    hasActiveScreenShare ||
    Boolean(participant.videoEnabled && participant.mediaStream);
  const muted = isCurrentIdentity ? call.muted : volumePercent === 0;

  const updateVolume = (nextVolume: number) => {
    if (!isCurrentIdentity) {
      onParticipantVolumeChange(participant.identityId, nextVolume);
    }
  };
  const toggleParticipantMute = () => {
    if (isCurrentIdentity) {
      onToggleMute();

      return;
    }

    updateVolume(volumePercent === 0 ? 100 : 0);
  };
  const updateScreenShareVolume = (nextVolume: number) => {
    if (!isCurrentIdentity) {
      onParticipantScreenShareVolumeChange?.(
        participant.identityId,
        nextVolume,
      );
    }
  };

  return (
    <article
      className={cx(
        'flex shrink-0 flex-col items-center rounded-lg border bg-black/20 text-center transition',
        variant === 'strip'
          ? 'min-h-[150px] w-[154px] p-2 sm:min-h-[222px] sm:w-[230px] sm:p-3'
          : hasVisualMedia
            ? 'min-h-[320px] w-full max-w-[340px] justify-center px-3 py-4 sm:min-h-[350px]'
            : 'min-h-[250px] w-full max-w-[280px] justify-center px-3 py-4 sm:min-h-[270px]',
        participant.speaking
          ? 'border-emerald-300 shadow-[0_0_0_2px_rgba(110,231,183,0.25)]'
          : 'border-white/10',
      )}
    >
      <CallParticipantMedia
        isCurrentIdentity={isCurrentIdentity}
        name={participantName}
        onExpandScreen={onExpandScreen}
        participant={participant}
        preferScreenPreview={variant === 'grid'}
        variant={variant}
      />
      <div className="mt-1.5 w-full shrink-0 sm:mt-2">
        <div className="flex max-w-full items-center justify-center gap-1.5">
          <h3 className="min-w-0 truncate text-sm font-black text-white sm:text-base">
            {participantName}
          </h3>
          <span
            className={cx(
              'shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5',
              participant.mediaEncryptionActive
                ? 'text-emerald-300'
                : 'text-amber-300',
            )}
            title={
              participant.mediaEncryptionActive
                ? copy.calls.participantMediaEncrypted
                : copy.calls.participantMediaNotEncrypted
            }
          >
            <LockIcon active={participant.mediaEncryptionActive === true} />
          </span>
        </div>
        <p className="mt-0.5 max-w-full truncate text-[0.65rem] text-white/45 sm:text-xs">
          {participantSubtitle}
        </p>
      </div>
      <CallParticipantAudioControls
        hasMicrophone={call.hasMicrophone}
        hasScreenShare={hasActiveScreenShare}
        isCurrentIdentity={isCurrentIdentity}
        muted={muted}
        onScreenShareVolumeChange={updateScreenShareVolume}
        onToggleMute={toggleParticipantMute}
        onVoiceVolumeChange={updateVolume}
        screenShareVolumePercent={screenShareVolumePercent}
        showScreenShareVolume={variant !== 'strip'}
        variant={variant}
        voiceVolumePercent={volumePercent}
      />
      {variant === 'grid' && (
        <CallParticipantMetrics call={call} participant={participant} />
      )}
    </article>
  );
}

function participantTileSubtitle(
  participant: CallSession['participants'][number],
): string {
  const participantHandle = participant.identity?.profile.handle?.trim();

  return participantHandle
    ? `@${participantHandle}`
    : shortId(participant.identityId);
}
