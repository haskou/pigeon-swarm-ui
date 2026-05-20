import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/en';

export function RawMessageDialog({
  message,
  onClose,
}: {
  message: ChatMessage;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-md">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="glass-panel-strong relative z-10 flex max-h-[84vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl p-5 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black">{copy.messages.rawTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15"
            aria-label={copy.dialog.close}
          >
            &times;
          </button>
        </div>
        <pre className="mt-4 min-h-0 overflow-auto rounded-2xl bg-black/35 p-4 text-xs leading-5 text-white/70">
          {JSON.stringify(message.raw, null, 2)}
        </pre>
      </section>
    </div>
  );
}
