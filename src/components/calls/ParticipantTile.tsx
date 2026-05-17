import type { CallSession } from '../../domain/calls/CallSession';

import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { shortId } from '../../utils/formatting';
import { MicrophoneIcon } from './CallIcons';
import { VideoPreview } from './VideoPreview';

export function ParticipantTile({
  call,
  onParticipantVolumeChange,
  onToggleMute,
  participant,
}: {
  call: CallSession;
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
        'flex h-[260px] w-full max-w-[260px] flex-col items-center overflow-hidden rounded-[1.5rem] border bg-black/25 p-3 text-center transition sm:h-[280px] sm:max-w-[280px]',
        participant.speaking
          ? 'border-emerald-300 shadow-[0_0_0_2px_rgba(110,231,183,0.25)]'
          : 'border-white/10',
      )}
    >
      <ParticipantMedia
        isCurrentIdentity={isCurrentIdentity}
        name={participantName}
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
  participant,
}: {
  isCurrentIdentity: boolean;
  name: string;
  participant: CallSession['participants'][number];
}) {
  const mediaStream = participant.mediaStream;
  const videoVisible = Boolean(participant.videoEnabled && mediaStream);

  return (
    <div
      className={cx(
        'relative mt-3 grid shrink-0 place-items-center overflow-hidden rounded-2xl',
        videoVisible
          ? 'h-28 w-full bg-black sm:h-32'
          : 'h-20 w-20 bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-3xl font-black text-slate-950 sm:h-24 sm:w-24',
      )}
    >
      {videoVisible && mediaStream ? (
        <VideoPreview
          label={name}
          muted={isCurrentIdentity}
          stream={mediaStream}
        />
      ) : participant.picture ? (
        <img
          src={participant.picture}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
      {participant.screenSharing && (
        <span className="absolute right-3 top-3 rounded-full bg-emerald-400 px-2 py-0.5 text-[0.6rem] font-black text-slate-950">
          {copy.calls.screen}
        </span>
      )}
    </div>
  );
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
    <label className="mt-auto w-full text-left text-[0.65rem] font-black text-white/55">
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
    <div className="min-w-0 rounded-2xl bg-white/8 px-1.5 py-1">
      <dt className="truncate text-white/35">{label}</dt>
      <dd className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-black text-white/85">
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
