import { memo, type MouseEvent } from 'react';

import type { CommunityVoiceChannel } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import {
  CameraIcon,
  HeadphonesIcon,
  MicrophoneIcon,
  ScreenShareIcon,
} from '../../../calls/presentation/components/callIcons';
import { VoiceIcon } from './communityDialogPrimitives';

export type VoiceParticipantView = {
  deafened?: boolean;
  identityId: string;
  muted: boolean;
  name: string;
  picture?: null | string;
  screenSharing?: boolean;
  speaking?: boolean;
  videoEnabled?: boolean;
};

export const VoiceChannelButton = memo(function VoiceChannelButton({
  active,
  channel,
  onJoin,
  onParticipantClick,
  participants,
}: {
  active: boolean;
  channel: CommunityVoiceChannel;
  onJoin: (channel: CommunityVoiceChannel) => void;
  onParticipantClick: (
    participant: VoiceParticipantView,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  participants: VoiceParticipantView[];
}) {
  return (
    <div
      className={cx(
        'overflow-hidden rounded-2xl',
        active ? 'bg-white/10' : 'bg-transparent',
      )}
    >
      <button
        type="button"
        onClick={() => onJoin(channel)}
        className={cx(
          'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-black transition',
          active ? 'text-emerald-200' : 'text-white/75 hover:bg-white/12',
        )}
        title={copy.calls.joinVoice}
      >
        <span className="grid w-5 place-items-center text-emerald-300">
          <VoiceIcon />
        </span>
        <span className="min-w-0 flex-1 truncate">
          {channel.name}
          {participants.length > 0 && (
            <span className="font-bold text-white/35">
              {' '}
              · {participants.length}
            </span>
          )}
        </span>
      </button>
      {participants.length > 0 && (
        <div className="space-y-0.5 px-3 pb-2">
          {participants.map((participant) => (
            <VoiceParticipantButton
              active={active}
              key={participant.identityId}
              participant={participant}
              onClick={onParticipantClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}, areVoiceChannelButtonPropsEqual);

function areVoiceChannelButtonPropsEqual(
  previous: {
    active: boolean;
    channel: CommunityVoiceChannel;
    participants: VoiceParticipantView[];
  },
  next: {
    active: boolean;
    channel: CommunityVoiceChannel;
    participants: VoiceParticipantView[];
  },
): boolean {
  return (
    previous.active === next.active &&
    previous.channel.id === next.channel.id &&
    previous.channel.name === next.channel.name &&
    areVoiceParticipantsEqual(previous.participants, next.participants)
  );
}

function areVoiceParticipantsEqual(
  previous: VoiceParticipantView[],
  next: VoiceParticipantView[],
): boolean {
  if (previous.length !== next.length) return false;

  return previous.every((participant, index) => {
    const nextParticipant = next[index];

    return (
      participant.identityId === nextParticipant.identityId &&
      participant.name === nextParticipant.name &&
      participant.picture === nextParticipant.picture &&
      participant.muted === nextParticipant.muted &&
      participant.deafened === nextParticipant.deafened &&
      participant.screenSharing === nextParticipant.screenSharing &&
      participant.videoEnabled === nextParticipant.videoEnabled &&
      participant.speaking === nextParticipant.speaking
    );
  });
}

const VoiceParticipantButton = memo(function VoiceParticipantButton({
  active,
  onClick,
  participant,
}: {
  active: boolean;
  onClick: (
    participant: VoiceParticipantView,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  participant: VoiceParticipantView;
}) {
  const speaking = active && participant.speaking;

  return (
    <button
      type="button"
      onClick={(event) => onClick(participant, event)}
      className={cx(
        'flex w-full items-center gap-2 rounded-2xl border px-2 py-1.5 text-left text-sm transition hover:bg-white/8 hover:text-white',
        speaking
          ? 'border-emerald-300/80 bg-emerald-400/10 text-emerald-100 shadow-[0_0_0_2px_rgba(110,231,183,0.18)]'
            : 'border-transparent text-white/55',
      )}
    >
      <div
        className={cx(
          'grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-xs font-black text-slate-950',
          speaking && 'ring-2 ring-emerald-200/60',
        )}
      >
        {participant.picture ? (
          <img
            src={participant.picture}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          participant.name.slice(0, 1).toUpperCase()
        )}
      </div>
      <span className="min-w-0 flex-1 truncate">
        {voiceParticipantName(participant.name)}
      </span>
      <VoiceParticipantStatusIcons
        deafened={participant.deafened}
        muted={participant.muted}
        screenSharing={participant.screenSharing}
        videoEnabled={participant.videoEnabled}
      />
    </button>
  );
}, areVoiceParticipantButtonPropsEqual);

function areVoiceParticipantButtonPropsEqual(
  previous: {
    active: boolean;
    participant: VoiceParticipantView;
  },
  next: {
    active: boolean;
    participant: VoiceParticipantView;
  },
): boolean {
  return (
    previous.active === next.active &&
    previous.participant.identityId === next.participant.identityId &&
    previous.participant.name === next.participant.name &&
    previous.participant.picture === next.participant.picture &&
    previous.participant.muted === next.participant.muted &&
    previous.participant.deafened === next.participant.deafened &&
    previous.participant.screenSharing === next.participant.screenSharing &&
    previous.participant.videoEnabled === next.participant.videoEnabled &&
    previous.participant.speaking === next.participant.speaking
  );
}

const VoiceParticipantStatusIcons = memo(function VoiceParticipantStatusIcons({
  deafened,
  muted,
  screenSharing,
  videoEnabled,
}: {
  deafened?: boolean;
  muted: boolean;
  screenSharing?: boolean;
  videoEnabled?: boolean;
}) {
  if (!muted && !deafened && !screenSharing && !videoEnabled) return null;

  return (
    <span className="flex shrink-0 items-center gap-1 text-fuchsia-200 [&_svg]:h-4 [&_svg]:w-4">
      {screenSharing && <ScreenShareIcon active />}
      {videoEnabled && <CameraIcon active />}
      {muted && <MicrophoneIcon muted />}
      {deafened && <HeadphonesIcon deafened />}
    </span>
  );
});

function voiceParticipantName(name: string): string {
  return name.replace(/\s*\(@[^)]*\)\s*$/, '').trim() || name;
}
