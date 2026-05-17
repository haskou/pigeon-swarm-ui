import type { MouseEvent, ReactNode } from 'react';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { CallSession } from '../../domain/calls/CallSession';

import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { shortId } from '../../utils/formatting';
import { dialingCallSoundUrl, playAnsweredCallSound } from '../../utils/sounds';

interface GlobalCallBarProps {
  call: CallSession;
  onEnd: () => void;
  onParticipantVolumeChange: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onToggleDeafen: () => void;
  onToggleMute: () => void;
}

export function GlobalCallBar({
  call,
  onEnd,
  onParticipantVolumeChange,
  onToggleDeafen,
  onToggleMute,
}: GlobalCallBarProps) {
  const [stageOpen, setStageOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const subtitle =
    call.subtitle ||
    call.participants.map((participant) => participant.name).join(', ');
  const microphoneWarningVisible = !call.hasMicrophone;
  const ringingParticipantCount = useMemo(
    () =>
      call.call?.participants.filter(
        (participant) => participant.status === 'ringing',
      ).length ?? 0,
    [call.call?.participants],
  );
  const joinedParticipantCount = useMemo(
    () =>
      call.call?.participants.filter(
        (participant) => participant.status === 'joined',
      ).length ?? 0,
    [call.call?.participants],
  );
  const previousJoinedParticipantCountRef = useRef(joinedParticipantCount);

  useEffect(() => {
    if (
      call.kind === 'community-voice' ||
      ringingParticipantCount === 0 ||
      call.status === 'permission-denied'
    ) {
      return undefined;
    }

    const audio = new Audio(dialingCallSoundUrl);

    audio.loop = true;
    audio.volume = 0.35;
    void audio.play().catch(() => undefined);

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [call.status, ringingParticipantCount]);

  useEffect(() => {
    const previousJoinedParticipantCount =
      previousJoinedParticipantCountRef.current;

    if (joinedParticipantCount > previousJoinedParticipantCount) {
      playAnsweredCallSound();
    }

    previousJoinedParticipantCountRef.current = joinedParticipantCount;
  }, [joinedParticipantCount]);

  return (
    <>
      <aside
        role="button"
        tabIndex={0}
        onClick={() => setStageOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') setStageOpen(true);
        }}
        className="mb-2 cursor-pointer rounded-2xl border border-white/10 bg-[#151722]/95 p-2.5 shadow-xl shadow-black/35 backdrop-blur-xl transition hover:bg-[#191b29]/95"
      >
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-200">
            <SpeakerIcon />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-sm font-black text-white">
                {call.title}
              </h2>
            </div>
            <p className="mt-0.5 truncate text-[0.7rem] text-white/45">
              {call.status === 'permission-denied'
                ? copy.calls.microphoneUnavailable
                : subtitle || copy.calls.waitingForParticipants}
            </p>
            {microphoneWarningVisible && (
              <p className="mt-1 truncate text-[0.68rem] font-bold text-amber-200/85">
                {copy.calls.microphoneUnavailable}
              </p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <CallButton
              active={call.muted}
              label={call.muted ? copy.calls.unmute : copy.calls.mute}
              onClick={(event) => {
                event.stopPropagation();
                onToggleMute();
              }}
              disabled={!call.hasMicrophone}
            >
              <MicrophoneIcon muted={call.muted} />
            </CallButton>
            <CallButton
              active={call.deafened}
              label={call.deafened ? copy.calls.undeafen : copy.calls.deafen}
              onClick={(event) => {
                event.stopPropagation();
                onToggleDeafen();
              }}
            >
              <HeadphonesIcon deafened={call.deafened} />
            </CallButton>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEnd();
              }}
              className="grid h-9 w-9 place-items-center rounded-2xl border border-rose-200/40 bg-rose-500 text-white shadow-lg shadow-rose-950/30 ring-2 ring-rose-500/20 transition hover:bg-rose-400 hover:ring-rose-300/35"
              aria-label={copy.calls.leave}
              title={copy.calls.leave}
            >
              <HangUpIcon />
            </button>
          </div>
        </div>
      </aside>
      {stageOpen &&
        createPortal(
          <CallStageDialog
            call={call}
            dataOpen={dataOpen}
            onClose={() => setStageOpen(false)}
            onDataToggle={() => setDataOpen((isOpen) => !isOpen)}
            onEnd={onEnd}
            onParticipantVolumeChange={onParticipantVolumeChange}
            onToggleDeafen={onToggleDeafen}
            onToggleMute={onToggleMute}
            subtitle={subtitle}
          />,
          document.body,
        )}
    </>
  );
}

function CallButton({
  active,
  children,
  disabled = false,
  label,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={cx(
        'grid h-9 w-9 place-items-center rounded-2xl transition',
        disabled
          ? 'cursor-not-allowed bg-white/5 text-white/30'
          : active
            ? 'bg-fuchsia-500 text-white hover:bg-fuchsia-400'
            : 'bg-white/10 text-white/75 hover:bg-white/15',
      )}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function CallStageDialog({
  call,
  dataOpen,
  onClose,
  onDataToggle,
  onEnd,
  onParticipantVolumeChange,
  onToggleDeafen,
  onToggleMute,
  subtitle,
}: {
  call: CallSession;
  dataOpen: boolean;
  onClose: () => void;
  onDataToggle: () => void;
  onEnd: () => void;
  onParticipantVolumeChange: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onToggleDeafen: () => void;
  onToggleMute: () => void;
  subtitle: string;
}) {
  const microphoneWarningVisible = !call.hasMicrophone;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[110] bg-[#060712]/95 p-4 text-white backdrop-blur-xl sm:p-6"
      onClick={onClose}
    >
      <section
        className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 p-4 sm:p-5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-200">
            <SpeakerIcon />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-black text-white">
              {call.title}
            </h2>
            <p className="truncate text-sm text-white/50">
              {call.status === 'permission-denied'
                ? copy.calls.microphoneUnavailable
                : subtitle || copy.calls.waitingForParticipants}
            </p>
            {microphoneWarningVisible && (
              <p className="mt-1 text-xs font-bold text-amber-200/85">
                {copy.calls.microphoneUnavailable}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onDataToggle}
            className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15"
          >
            {dataOpen ? 'Hide call data' : 'View call data'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white"
            aria-label={copy.dialog.close}
          >
            ×
          </button>
        </header>

        <div
          className={cx(
            'min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:p-5',
            dataOpen ? 'flex flex-col lg:flex-row' : 'flex',
          )}
        >
          <div className="flex min-h-full flex-1 flex-wrap content-center items-center justify-center gap-4">
            {call.participants.map((participant) => (
              <ParticipantTile
                key={participant.identityId}
                call={call}
                onParticipantVolumeChange={onParticipantVolumeChange}
                onToggleMute={onToggleMute}
                participant={participant}
              />
            ))}
          </div>

          {dataOpen && (
            <div className="min-h-0 w-full shrink-0 lg:w-[360px]">
              <CallDataPanel call={call} />
            </div>
          )}
        </div>

        <footer className="flex items-center justify-center gap-3 border-t border-white/10 p-4">
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
          <button
            type="button"
            onClick={onEnd}
            className="grid h-12 w-12 place-items-center rounded-2xl border border-rose-200/40 bg-rose-500 text-white shadow-lg shadow-rose-950/30 ring-2 ring-rose-500/20 transition hover:bg-rose-400 hover:ring-rose-300/35"
            aria-label={copy.calls.leave}
            title={copy.calls.leave}
          >
            <HangUpIcon />
          </button>
        </footer>
      </section>
    </div>
  );
}

function ParticipantTile({
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
  const latencyLabel =
    participant.latencyMs === undefined ? '—' : `${participant.latencyMs} ms`;
  const packetLossLabel =
    participant.packetsLost === undefined
      ? '—'
      : String(participant.packetsLost);
  const connectionLabel = callParticipantStatus(participant, call);
  const participantHandle = participant.identity?.profile.handle?.trim();
  const participantSubtitle = participantHandle
    ? `@${participantHandle}`
    : shortId(participant.identityId);
  const participantName =
    participant.identity?.profile.name?.trim() ||
    participant.name.replace(/\s*\(@[^)]*\)\s*$/, '').trim() ||
    participantSubtitle;
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
      <div className="mt-3 grid shrink-0 place-items-center">
        <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-3xl font-black text-slate-950 sm:h-24 sm:w-24">
          {participant.picture ? (
            <img
              src={participant.picture}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            participantName.slice(0, 1).toUpperCase()
          )}
        </div>
      </div>
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
          {muted ? copy.calls.unmute : copy.calls.mute}
        </button>
      </div>
      <label className="mt-auto w-full text-left text-[0.65rem] font-black text-white/55">
        <span className="flex items-center justify-between gap-2">
          <span>Volume</span>
          <span className="text-white/85">{volumePercent}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={250}
          step={5}
          value={isCurrentIdentity ? 100 : volumePercent}
          disabled={isCurrentIdentity}
          onChange={(event) => updateVolume(Number(event.target.value))}
          className="mt-2 h-2 w-full accent-emerald-300 disabled:cursor-not-allowed disabled:opacity-35"
        />
      </label>
      <dl className="mt-2 grid w-full grid-cols-3 gap-1.5 text-left text-[0.58rem]">
        <Metric label="Status" value={connectionLabel} />
        <Metric label="Latency" value={latencyLabel} />
        <Metric label="Lost" value={packetLossLabel} />
      </dl>
    </article>
  );
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

function CallDataPanel({ call }: { call: CallSession }) {
  const data = {
    call: call.call ?? null,
    frontend: {
      channelId: call.channelId,
      communityId: call.communityId,
      conversationId: call.conversationId,
      hasMicrophone: call.hasMicrophone,
      kind: call.kind,
      status: call.status,
      subtitle: call.subtitle,
      title: call.title,
    },
    participants: call.participants.map((participant) => ({
      audioLevel: participant.audioLevel,
      connectionState: participant.connectionState,
      identityId: participant.identityId,
      latencyMs: participant.latencyMs,
      muted: participant.muted,
      name: participant.name,
      packetsLost: participant.packetsLost,
      speaking: participant.speaking,
      status: participant.status,
    })),
  };

  return (
    <aside className="min-h-0 rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
      <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white/40">
        Call data
      </h3>
      <pre className="mt-3 max-h-full overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-black/35 p-3 text-xs leading-relaxed text-white/70">
        {JSON.stringify(data, null, 2)}
      </pre>
    </aside>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M4 9.5v5h3.2L12 18.2V5.8L7.2 9.5H4Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MicrophoneIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      {muted && (
        <path
          d="M5 5l14 14"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
      )}
    </svg>
  );
}

function HeadphonesIcon({ deafened }: { deafened: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M5 14v-2a7 7 0 0 1 14 0v2M5 14h3v5H6a1 1 0 0 1-1-1v-4Zm14 0h-3v5h2a1 1 0 0 0 1-1v-4Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      {deafened && (
        <path
          d="M5 5l14 14"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
      )}
    </svg>
  );
}

function HangUpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5 rotate-[135deg]"
      aria-hidden="true"
    >
      <path
        d="M7.8 4.9 6.3 7a2 2 0 0 0-.2 1.9c1.1 2.8 3.2 5 6 6 0.7.2 1.4.2 2-.2l2.1-1.5a1.7 1.7 0 0 1 2.2.2l2 2a1.8 1.8 0 0 1 0 2.5l-1 1a4 4 0 0 1-4.2.9C9.5 17.9 6.1 14.5 4.2 8.8a4 4 0 0 1 .9-4.2l1-1a1.8 1.8 0 0 1 2.5 0l2 2a1.7 1.7 0 0 1 .2 2.2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
