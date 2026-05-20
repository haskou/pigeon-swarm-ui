import type { CallSession } from '../../domain/callSession.types';

import { copy } from '../../../../shared/presentation/i18n/en';
import { cx } from '../../../../shared/presentation/classNameHelper';
import { shortId } from '../../../../shared/presentation/formatting';
import { identityPicture } from '../../../identities/presentation/view-models/identityDisplay';
import { FallbackImage } from '../../../../shared/presentation/components/fallbackImage';
import { MicrophoneIcon } from './callIcons';
import { VideoPreview } from './videoPreview';

export function ParticipantTile({
  call,
  onExpandScreen,
  onParticipantVolumeChange,
  onToggleMute,
  participant,
}: {
  call: CallSession;
  onExpandScreen?: (participant: CallSession['participants'][number]) => void;
  onParticipantVolumeChange: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onToggleMute: () => void;
  participant: CallSession['participants'][number];
}) {
  const isCurrentIdentity = participant.identityId === call.currentIdentityId;
  const volumePercent = isCurrentIdentity
    ? 100
    : (call.participantVolumes[participant.identityId] ?? 100);
  const participantName = participantTileName(participant);
  const participantSubtitle = participantTileSubtitle(participant);
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

  return (
    <article
      className={cx(
        'flex min-h-[340px] w-full max-w-[300px] flex-col items-center rounded-[1.5rem] border bg-black/25 p-3 text-center transition sm:min-h-[360px] sm:max-w-[340px]',
        participant.speaking
          ? 'border-emerald-300 shadow-[0_0_0_2px_rgba(110,231,183,0.25)]'
          : 'border-white/10',
      )}
    >
      <ParticipantMedia
        isCurrentIdentity={isCurrentIdentity}
        name={participantName}
        onExpandScreen={onExpandScreen}
        participant={participant}
      />
      <div className="mt-2 w-full shrink-0">
        <h3 className="max-w-full truncate text-base font-black text-white">
          {participantName}
        </h3>
        <p className="mt-0.5 max-w-full truncate text-xs text-white/45">
          {participantSubtitle}
        </p>
      </div>
      <div className="mt-1 flex min-h-5 flex-wrap justify-center gap-1.5 text-[0.65rem] text-white/45">
        <button
          type="button"
          onClick={toggleParticipantMute}
          disabled={isCurrentIdentity && !call.hasMicrophone}
          className={cx(
            'rounded-full px-2 py-0.5 font-black transition',
            muted
              ? 'bg-fuchsia-500/25 text-fuchsia-100 hover:bg-fuchsia-500/35'
              : 'bg-white/10 text-white/65 hover:bg-white/15 hover:text-white',
            isCurrentIdentity &&
              !call.hasMicrophone &&
              'cursor-not-allowed opacity-40',
          )}
        >
          <MicrophoneIcon muted={muted} />
        </button>
      </div>
      <ParticipantVolume
        disabled={isCurrentIdentity}
        onChange={updateVolume}
        value={volumePercent}
      />
      <ParticipantMetrics call={call} participant={participant} />
    </article>
  );
}

function ParticipantMedia({
  isCurrentIdentity,
  name,
  onExpandScreen,
  participant,
}: {
  isCurrentIdentity: boolean;
  name: string;
  onExpandScreen?: (participant: CallSession['participants'][number]) => void;
  participant: CallSession['participants'][number];
}) {
  const mediaStream = participant.mediaStream;
  const picture =
    participant.picture ?? participantIdentityPicture(participant);
  const videoVisible = Boolean(participant.videoEnabled && mediaStream);
  const canExpandScreen = Boolean(
    participant.screenSharing && participant.screenStream,
  );

  const media = (
    <div
      className={cx(
        'relative mt-3 grid shrink-0 place-items-center overflow-hidden rounded-2xl',
        videoVisible
          ? 'aspect-video w-full bg-black'
          : 'h-20 w-20 bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-3xl font-black text-slate-950 sm:h-24 sm:w-24',
      )}
    >
      {canExpandScreen && participant.screenStream ? (
        <VideoPreview
          fit="contain"
          label={name}
          muted={isCurrentIdentity}
          stream={participant.screenStream}
        />
      ) : videoVisible && mediaStream ? (
        <VideoPreview
          fit="contain"
          label={name}
          muted={isCurrentIdentity}
          stream={mediaStream}
        />
      ) : (
        <FallbackImage
          src={picture}
          alt=""
          className="h-full w-full object-cover"
          fallback={name.slice(0, 1).toUpperCase()}
        />
      )}
      {participant.screenSharing && (
        <span className="absolute right-3 top-3 rounded-full bg-emerald-400 px-2 py-0.5 text-[0.6rem] font-black text-slate-950">
          {copy.calls.screen}
        </span>
      )}
    </div>
  );

  if (!canExpandScreen || !onExpandScreen) return media;

  return (
    <button
      type="button"
      onClick={() => onExpandScreen(participant)}
      className="w-full"
      title={copy.calls.screen}
    >
      {media}
    </button>
  );
}

function participantIdentityPicture(
  participant: CallSession['participants'][number],
): string | null {
  return participant.identity ? identityPicture(participant.identity) : null;
}

function ParticipantVolume({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (nextVolume: number) => void;
  value: number;
}) {
  return (
    <label className="mt-3 w-full text-left text-[0.65rem] font-black text-white/55">
      <span className="flex items-center justify-between gap-2">
        <span>Volume</span>
        <span className="text-white/85">{value}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={250}
        step={5}
        value={disabled ? 100 : value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-2 w-full accent-emerald-300 disabled:cursor-not-allowed disabled:opacity-35"
      />
    </label>
  );
}

function ParticipantMetrics({
  call,
  participant,
}: {
  call: CallSession;
  participant: CallSession['participants'][number];
}) {
  const latencyLabel =
    participant.latencyMs === undefined ? '-' : `${participant.latencyMs} ms`;
  const packetLossLabel =
    participant.packetsLost === undefined
      ? '-'
      : String(participant.packetsLost);

  return (
    <dl className="mt-2 grid w-full grid-cols-3 gap-1.5 text-left text-[0.58rem]">
      <Metric label="Status" value={callParticipantStatus(participant, call)} />
      <Metric label="Latency" value={latencyLabel} />
      <Metric label="Lost" value={packetLossLabel} />
    </dl>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      className={cx(
        'min-w-0 rounded-xl border border-white/8 bg-white/6 px-2 py-1.5',
      )}
    >
      <dt className="text-[0.55rem] font-black uppercase text-white/35">
        {label}
      </dt>
      <dd className="mt-0.5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-black leading-tight text-white/85">
        {value}
      </dd>
    </div>
  );
}

function participantTileName(
  participant: CallSession['participants'][number],
): string {
  return (
    participant.identity?.profile.name?.trim() ||
    participant.name.replace(/\s*\(@[^)]*\)\s*$/, '').trim() ||
    participantTileSubtitle(participant)
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

function callParticipantStatus(
  participant: CallSession['participants'][number],
  call: CallSession,
): string {
  if (participant.identityId === call.currentIdentityId) return call.status;

  if (participant.connectionState) return participant.connectionState;

  if (participant.status) return participant.status;

  return call.status;
}
