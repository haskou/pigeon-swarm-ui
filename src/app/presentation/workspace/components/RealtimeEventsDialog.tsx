import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/realtimeGateway';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { formatTime } from '../../../../shared/presentation/formatting';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';

interface RealtimeEventsDialogProps {
  events: RealtimeDomainEvent[];
  onClose: () => void;
}

export function RealtimeEventsDialog({
  events,
  onClose,
}: RealtimeEventsDialogProps) {
  useCloseOnEscape(onClose);

  return (
    <div className="fixed inset-0 z-[95] bg-black/55 p-3 backdrop-blur-sm sm:p-5">
      <section className="glass-panel-strong mx-auto flex h-full w-full max-w-4xl flex-col rounded-2xl p-4 shadow-2xl shadow-black/45">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
              WebSocket
            </div>
            <h2 className="mt-1 text-xl font-black text-white">
              {copy.chat.realtimeEventsTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15"
            aria-label={copy.dialog.close}
          >
            ×
          </button>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-2xl bg-black/30 p-3">
          {events.length === 0 ? (
            <div className="grid h-full place-items-center text-center text-sm text-white/45">
              {copy.chat.realtimeEventsEmpty}
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <article
                  key={event.event_id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-black text-emerald-200">
                      {event.type}
                    </span>
                    <span className="text-white/40">
                      {formatTime(event.occurred_on)}
                    </span>
                  </div>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-white/70">
                    {JSON.stringify(event, null, 2)}
                  </pre>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
