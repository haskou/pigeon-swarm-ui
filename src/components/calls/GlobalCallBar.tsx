import type { ReactNode } from 'react';

import type { CallSession } from '../../domain/calls/CallSession';

import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';

interface GlobalCallBarProps {
  call: CallSession;
  onEnd: () => void;
  onToggleDeafen: () => void;
  onToggleMute: () => void;
}

export function GlobalCallBar({
  call,
  onEnd,
  onToggleDeafen,
  onToggleMute,
}: GlobalCallBarProps) {
  const participantNames = call.participants
    .map((participant) => participant.name)
    .join(', ');

  return (
    <aside className="fixed bottom-3 left-1/2 z-[90] w-[calc(100vw-1.5rem)] max-w-3xl -translate-x-1/2 rounded-[1.5rem] border border-white/10 bg-[#151722]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-200">
          <SpeakerIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cx(
                'h-2.5 w-2.5 shrink-0 rounded-full',
                call.status === 'live' ? 'bg-emerald-300' : 'bg-amber-300',
              )}
            />
            <h2 className="truncate text-sm font-black text-white">
              {call.title}
            </h2>
          </div>
          <p className="mt-0.5 truncate text-xs text-white/45">
            {call.status === 'permission-denied'
              ? copy.calls.microphoneUnavailable
              : participantNames || copy.calls.waitingForParticipants}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <CallButton
            active={call.muted}
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
            className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-950/30 transition hover:bg-rose-400"
            aria-label={copy.calls.leave}
            title={copy.calls.leave}
          >
            <HangUpIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}

function CallButton({
  active,
  children,
  label,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'grid h-11 w-11 place-items-center rounded-2xl transition',
        active
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
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M7.2 14.8 5.5 17a1.4 1.4 0 0 0 .2 2l1.2.9a1.4 1.4 0 0 0 1.6 0c2.1-1.2 4.9-1.2 7 0a1.4 1.4 0 0 0 1.6 0l1.2-.9a1.4 1.4 0 0 0 .2-2l-1.7-2.2a2 2 0 0 0-2.1-.7 9.3 9.3 0 0 1-5.4 0 2 2 0 0 0-2.1.7Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
