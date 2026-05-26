import type { CallSession } from '../../domain/callSession.types';

import { cx } from '../../../../shared/presentation/cx';
import { shortId } from '../../../../shared/presentation/formatting';
import { CallParticipantAudioControls } from './CallParticipantAudioControls';
import { callParticipantHasActiveScreenShare } from './callParticipantHasActiveScreenShare';
import { callParticipantDisplayName } from './callParticipantDisplayName';
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
        'flex shrink-0 flex-col items-center rounded-[1.5rem] border bg-black/25 text-center transition',
        variant === 'strip'
          ? 'min-h-[222px] w-[230px] p-3'
          : 'min-h-[340px] w-full max-w-[300px] justify-center px-3 py-5 sm:min-h-[360px] sm:max-w-[340px] sm:py-6',
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
      <div className="mt-2 w-full shrink-0">
        <h3 className="max-w-full truncate text-base font-black text-white">
          {participantName}
        </h3>
        <p className="mt-0.5 max-w-full truncate text-xs text-white/45">
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
