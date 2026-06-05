import type { MouseEvent, PointerEvent } from 'react';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { PollResource } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';

const TOUCH_TAP_MAX_MS = 450;
const TOUCH_TAP_MAX_DISTANCE = 12;

export function PollCard({
  currentIdentityId,
  onClose,
  onMenuOpen,
  onRemoveVote,
  onVote,
  poll,
}: {
  currentIdentityId: string;
  onClose?: (poll: PollResource) => Promise<void>;
  onMenuOpen?: (x: number, y: number) => void;
  onRemoveVote: (poll: PollResource) => Promise<void>;
  onVote: (poll: PollResource, optionIds: string[]) => Promise<void>;
  poll: PollResource;
}) {
  const currentVote = poll.votes.find(
    (vote) => vote.voterIdentityId === currentIdentityId,
  );
  const mine = poll.creatorIdentityId === currentIdentityId;
  const counts = useMemo(() => countPollVotes(poll), [poll]);
  const totalVotes = poll.votes.length;
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(
    currentVote?.optionIds ?? [],
  );
  const [busy, setBusy] = useState(false);
  const touchTapRef = useRef<{
    startedAt: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    setSelectedOptionIds(currentVote?.optionIds ?? []);
  }, [currentVote?.optionIds]);

  const toggleOption = (optionId: string) => {
    setSelectedOptionIds((current) =>
      poll.allowsMultipleVotes
        ? current.includes(optionId)
          ? current.filter((candidate) => candidate !== optionId)
          : [...current, optionId]
        : [optionId],
    );
  };
  const submitVote = async () => {
    if (selectedOptionIds.length === 0 || poll.status === 'closed') return;

    setBusy(true);
    try {
      await onVote(poll, selectedOptionIds);
    } finally {
      setBusy(false);
    }
  };
  const removeVote = async () => {
    setBusy(true);
    try {
      await onRemoveVote(poll);
      setSelectedOptionIds([]);
    } finally {
      setBusy(false);
    }
  };
  const closePoll = async () => {
    if (!onClose) return;

    setBusy(true);
    try {
      await onClose(poll);
    } finally {
      setBusy(false);
    }
  };
  const clearTouchTap = () => {
    touchTapRef.current = null;
  };
  const openContextMenu = (x: number, y: number) => {
    if (!onMenuOpen) return;

    onMenuOpen(x, y);
  };
  const handleContextMenu = (event: MouseEvent) => {
    if (!onMenuOpen) return;
    if (isCoarsePointer()) return;

    event.preventDefault();
    openContextMenu(event.clientX, event.clientY);
  };
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (!onMenuOpen || isInteractivePollTarget(event)) {
      clearTouchTap();
      return;
    }

    if (!isTouchTap(touchTapRef.current, event)) {
      clearTouchTap();
      return;
    }

    clearTouchTap();
    event.preventDefault();
    openContextMenu(event.clientX, event.clientY);
  };
  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' || !onMenuOpen) return;

    touchTapRef.current = {
      startedAt: Date.now(),
      x: event.clientX,
      y: event.clientY,
    };
  };
  const handlePointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;

    const touchTap = touchTapRef.current;
    if (!touchTap) return;

    if (touchDistance(touchTap, event) > TOUCH_TAP_MAX_DISTANCE) {
      clearTouchTap();
    }
  };

  return (
    <div
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onPointerCancel={clearTouchTap}
      onPointerDown={handlePointerDown}
      onPointerLeave={clearTouchTap}
      onPointerMove={handlePointerMove}
      className={cx(
        'w-full max-w-xl select-text rounded-2xl border p-3 text-white shadow-xl sm:p-4',
        mine
          ? 'border-[#6f99aa]/35 bg-[#274279] shadow-[#102938]/25'
          : 'border-white/10 bg-black/25 shadow-black/20',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={cx(
              'text-[0.65rem] font-black uppercase tracking-[0.16em]',
              mine ? 'text-cyan-100/70' : 'text-fuchsia-200/70',
            )}
          >
            {copy.polls.poll}
          </div>
          <h3 className="mt-1 break-words text-sm font-black sm:text-base">
            {poll.question}
          </h3>
        </div>
        <span
          className={cx(
            'shrink-0 rounded-full px-2 py-1 text-[0.65rem] font-black uppercase',
            poll.status === 'open'
              ? 'bg-emerald-400/15 text-emerald-100'
              : 'bg-white/10 text-white/45',
          )}
        >
          {poll.status === 'open' ? copy.polls.open : copy.polls.closed}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:mt-4">
        {poll.options.map((option) => {
          const count = counts[option.id] ?? 0;
          const percent =
            totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const checked = selectedOptionIds.includes(option.id);

          return (
            <label
              key={option.id}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/8 p-2.5 sm:p-3"
            >
              <span
                aria-hidden="true"
                className={cx(
                  'absolute bottom-0 left-0 top-0',
                  mine ? 'bg-white/12' : 'bg-fuchsia-400/15',
                )}
                style={{ width: `${percent}%` }}
              />
              <span className="relative flex items-center gap-3">
                <input
                  type={poll.allowsMultipleVotes ? 'checkbox' : 'radio'}
                  checked={checked}
                  disabled={busy || poll.status === 'closed'}
                  onChange={() => toggleOption(option.id)}
                  name={`poll-${poll.id}`}
                />
                <span className="min-w-0 flex-1 break-words text-sm font-bold">
                  {option.text}
                </span>
                <span className="shrink-0 text-xs font-black text-white/55">
                  {count} · {percent}%
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 sm:mt-4">
        <span className="text-xs font-bold text-white/45">
          {totalVotes} {totalVotes === 1 ? copy.polls.vote : copy.polls.votes}
        </span>
        <div className="flex flex-wrap justify-end gap-1.5 sm:gap-2">
          {currentVote && poll.status === 'open' && (
            <button
              type="button"
              onClick={() => void removeVote()}
              disabled={busy}
              className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {copy.polls.removeVote}
            </button>
          )}
          {poll.status === 'open' && (
            <button
              type="button"
              onClick={() => void submitVote()}
              disabled={busy || selectedOptionIds.length === 0}
              className={cx(
                'rounded-xl bg-white px-3 py-2 text-xs font-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45',
                mine ? 'text-[#163142]' : 'text-slate-950',
              )}
            >
              {copy.polls.voteAction}
            </button>
          )}
          {poll.status === 'open' && onClose && (
            <button
              type="button"
              onClick={() => void closePoll()}
              disabled={busy}
              className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-black text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {copy.polls.close}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function countPollVotes(poll: PollResource): Record<string, number> {
  const counts = Object.fromEntries(
    poll.options.map((option) => [option.id, 0]),
  );

  for (const vote of poll.votes) {
    for (const optionId of vote.optionIds) {
      counts[optionId] = (counts[optionId] ?? 0) + 1;
    }
  }

  return counts;
}

function isCoarsePointer(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

function isInteractivePollTarget(event: MouseEvent<HTMLElement>): boolean {
  const target = event.target;
  const interactiveElement =
    target instanceof HTMLElement
      ? target.closest('a,button,input,textarea,select,label,[role="button"]')
      : null;

  return Boolean(
    interactiveElement && interactiveElement !== event.currentTarget,
  );
}

function isTouchTap(
  touchTap: { startedAt: number; x: number; y: number } | null,
  event: MouseEvent<HTMLElement>,
): boolean {
  if (!touchTap) return false;

  return (
    Date.now() - touchTap.startedAt <= TOUCH_TAP_MAX_MS &&
    touchDistance(touchTap, event) <= TOUCH_TAP_MAX_DISTANCE
  );
}

function touchDistance(
  touchTap: { x: number; y: number },
  event: MouseEvent<HTMLElement> | PointerEvent,
): number {
  return Math.hypot(event.clientX - touchTap.x, event.clientY - touchTap.y);
}
