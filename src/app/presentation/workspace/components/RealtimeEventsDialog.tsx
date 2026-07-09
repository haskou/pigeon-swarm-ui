import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { formatTime } from '../../../../shared/presentation/formatting';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { JsonTree } from '../../../../shared/presentation/components/JsonDataViewer';

interface RealtimeEventsDialogProps {
  events: RealtimeDomainEvent[];
  onClose: () => void;
}

export function RealtimeEventsDialog({
  events,
  onClose,
}: RealtimeEventsDialogProps) {
  const { close, state } = useCloseTransition(onClose);

  useCloseOnEscape(close);

  return (
    <div
      className="app-overlay-scrim fixed inset-0 z-[95] grid place-items-stretch bg-black/55 p-0 backdrop-blur-sm sm:place-items-center sm:p-5"
      data-state={state}
    >
      <button
        type="button"
        className="absolute inset-0"
        onClick={close}
        aria-label={copy.dialog.close}
      />
      <section
        className="app-overlay-surface app-safe-area-panel ui-dialog-surface relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden sm:h-[88vh] sm:max-w-4xl"
        data-state={state}
      >
        <DialogHeader
          kicker={copy.chat.realtimeEventsEyebrow}
          title={copy.chat.realtimeEventsTitle}
          onClose={close}
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {events.length === 0 ? (
            <div className="grid h-full place-items-center text-center text-sm text-white/45">
              {copy.chat.realtimeEventsEmpty}
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <article
                  key={event.event_id}
                  className="rounded-md border border-white/10 border-l-2 border-l-emerald-300/45 bg-white/[0.025] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-black text-emerald-200">
                      {event.type}
                    </span>
                    <span className="text-white/40">
                      {formatTime(event.occurred_on)}
                    </span>
                  </div>
                  <div className="mt-3 max-h-72 overflow-auto rounded-md border border-white/[0.07] bg-black/25 p-3 font-mono text-xs leading-5">
                    <JsonTree value={event} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
