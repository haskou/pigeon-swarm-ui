import type { ReactElement } from 'react';
import type { CallSession } from '../view-models/CallSession';

import { cx } from '../../../../shared/presentation/cx';
import { shortId } from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { LockIcon } from './callIcons';
import { CallParticipantAudioControls } from './CallParticipantAudioControls';
import { callParticipantDisplayName } from './callParticipantDisplayName';
import { callParticipantHasActiveScreenShare } from './callParticipantHasActiveScreenShare';
import { CallParticipantMedia } from './CallParticipantMedia';
import { CallParticipantMetrics } from './CallParticipantMetrics';

function participantTileSubtitle(
  participant: CallSession['participants'][number],
): string {
  const participantHandle = participant.identity?.profile.handle?.trim();

  return participantHandle
    ? `@${participantHandle}`
    : shortId(participant.identityId);
}

function participantVolume(
  volumes: Record<string, number>,
  identityId: string,
  isCurrentIdentity: boolean,
): number {
  return isCurrentIdentity ? 100 : (volumes[identityId] ?? 100);
}

function participantTileClassName(
  variant: 'grid' | 'strip',
  hasVisualMedia: boolean,
  speaking: boolean,
): string {
  const sizeClass =
    variant === 'strip'
      ? 'min-h-[150px] w-[154px] p-2 sm:min-h-[222px] sm:w-[230px] sm:p-3'
      : hasVisualMedia
        ? 'min-h-[320px] w-full max-w-[340px] justify-center px-3 py-4 sm:min-h-[350px]'
        : 'min-h-[250px] w-full max-w-[280px] justify-center px-3 py-4 sm:min-h-[270px]';
  const borderClass = speaking
    ? 'border-emerald-300 shadow-[0_0_0_2px_rgba(110,231,183,0.25)]'
    : 'border-white/10';

  return cx(
    'flex shrink-0 flex-col items-center rounded-lg border bg-black/20 text-center transition',
    sizeClass,
    borderClass,
  );
}

function participantAudioActions({
  identityId,
  isCurrentIdentity,
  onParticipantScreenShareVolumeChange,
  onParticipantVolumeChange,
  onToggleMute,
  volumePercent,
}: {
  identityId: string;
  isCurrentIdentity: boolean;
  onParticipantScreenShareVolumeChange?: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onParticipantVolumeChange: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onToggleMute: () => void;
  volumePercent: number;
}): {
  toggleParticipantMute: () => void;
  updateScreenShareVolume: (nextVolume: number) => void;
  updateVolume: (nextVolume: number) => void;
} {
  const updateVolume = (nextVolume: number): void => {
    if (!isCurrentIdentity) {
      onParticipantVolumeChange(identityId, nextVolume);
    }
  };
  const toggleParticipantMute = (): void => {
    if (isCurrentIdentity) {
      onToggleMute();

      return;
    }

    updateVolume(volumePercent === 0 ? 100 : 0);
  };
  const updateScreenShareVolume = (nextVolume: number): void => {
    if (!isCurrentIdentity) {
      onParticipantScreenShareVolumeChange?.(identityId, nextVolume);
    }
  };

  return { toggleParticipantMute, updateScreenShareVolume, updateVolume };
}

function ParticipantMediaEncryptionIndicator({
  active,
  visible,
}: {
  active: boolean;
  visible: boolean;
}): ReactElement | null {
  if (!visible) return null;

  return (
    <span
      className={cx(
        'shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5',
        active ? 'text-emerald-300' : 'text-amber-300',
      )}
      title={
        active
          ? copy.calls.participantMediaEncrypted
          : copy.calls.participantMediaNotEncrypted
      }
    >
      <LockIcon active={active} />
    </span>
  );
}

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
}): ReactElement {
  const isCurrentIdentity = participant.identityId === call.currentIdentityId;
  const volumePercent = participantVolume(
    call.participantVolumes,
    participant.identityId,
    isCurrentIdentity,
  );
  const screenShareVolumePercent = participantVolume(
    call.screenShareVolumes,
    participant.identityId,
    isCurrentIdentity,
  );
  const participantName = callParticipantDisplayName(participant);
  const participantSubtitle = participantTileSubtitle(participant);
  const hasActiveScreenShare = callParticipantHasActiveScreenShare(participant);
  const hasVisualMedia =
    hasActiveScreenShare ||
    Boolean(participant.videoEnabled && participant.mediaStream);
  const muted = isCurrentIdentity ? call.muted : volumePercent === 0;
  const { toggleParticipantMute, updateScreenShareVolume, updateVolume } =
    participantAudioActions({
      identityId: participant.identityId,
      isCurrentIdentity,
      onParticipantScreenShareVolumeChange,
      onParticipantVolumeChange,
      onToggleMute,
      volumePercent,
    });
  const isGrid = variant === 'grid';

  return (
    <article
      className={participantTileClassName(
        variant,
        hasVisualMedia,
        participant.speaking === true,
      )}
    >
      <CallParticipantMedia
        isCurrentIdentity={isCurrentIdentity}
        name={participantName}
        onExpandScreen={onExpandScreen}
        participant={participant}
        preferScreenPreview={isGrid}
        variant={variant}
      />
      <div className="mt-1.5 w-full shrink-0 sm:mt-2">
        <div className="flex max-w-full items-center justify-center gap-1.5">
          <h3 className="min-w-0 truncate text-sm font-black text-white sm:text-base">
            {participantName}
          </h3>
          <ParticipantMediaEncryptionIndicator
            active={participant.mediaEncryptionActive === true}
            visible={!isCurrentIdentity}
          />
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
        showScreenShareVolume={isGrid}
        variant={variant}
        voiceVolumePercent={volumePercent}
      />
      {isGrid && (
        <CallParticipantMetrics call={call} participant={participant} />
      )}
    </article>
  );
}
