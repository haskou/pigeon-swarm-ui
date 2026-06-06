import type { CallParticipant } from '../../domain/callSession.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { shortId } from '../../../../shared/presentation/formatting';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';

interface IncomingCallDialogProps {
  caller?: CallParticipant;
  onAccept: () => void;
  onDecline: () => void;
  title: string;
}

export function IncomingCallDialog({
  caller,
  onAccept,
  onDecline,
  title,
}: IncomingCallDialogProps) {
  useCloseOnEscape(onDecline);

  const handle = caller?.identity?.profile.handle?.trim();
  const fallbackName = caller?.name?.replace(/\s+\(@[^)]+\)$/, '').trim();
  const displayName =
    caller?.identity?.profile.name?.trim() || fallbackName || title;
  const rawSubtitle = handle
    ? `@${handle}`
    : caller
      ? shortId(caller.identityId)
      : undefined;
  const subtitle = rawSubtitle === displayName ? undefined : rawSubtitle;

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
      <section className="glass-panel-strong w-full max-w-sm rounded-2xl p-5 text-center shadow-2xl shadow-black/50">
        <div className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-3xl font-black text-slate-950">
          {caller?.picture ? (
            <img
              src={caller.picture}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            (caller?.name ?? title).slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-white/35">
          {copy.calls.incoming}
        </div>
        <h2 className="mt-2 truncate text-2xl font-black text-white">
          {displayName}
        </h2>
        {subtitle && (
          <p className="mt-1 truncate text-sm text-white/55">{subtitle}</p>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onDecline}
            className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-400"
          >
            {copy.calls.decline}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
          >
            {copy.calls.answer}
          </button>
        </div>
      </section>
    </div>
  );
}
