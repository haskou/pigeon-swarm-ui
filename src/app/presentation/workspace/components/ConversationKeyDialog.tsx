import { createPortal } from 'react-dom';

import { copy } from '../../../../shared/presentation/i18n/copy';

export function ConversationKeyDialog({
  encryptedConversationKey,
  error,
  input,
  mode,
  onClose,
  onCopy,
  onImport,
  onInputChange,
  saving,
}: {
  encryptedConversationKey: string;
  error: string | null;
  input: string;
  mode: 'add' | 'copy';
  onClose: () => void;
  onCopy: () => void;
  onImport: () => void;
  onInputChange: (value: string) => void;
  saving: boolean;
}) {
  const isCopy = mode === 'copy';

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-md">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="glass-panel-strong relative z-10 w-full max-w-xl rounded-2xl p-5 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">
              {isCopy
                ? copy.chat.copyPrivateKeyTitle
                : copy.chat.addPrivateKeyTitle}
            </h2>
            <p className="mt-1 text-sm text-white/55">
              {isCopy
                ? copy.chat.copyPrivateKeyBody
                : copy.chat.addPrivateKeyBody}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15"
            aria-label={copy.dialog.close}
          >
            &times;
          </button>
        </div>
        {isCopy ? (
          <>
            <textarea
              readOnly
              value={encryptedConversationKey}
              className="mt-5 h-40 w-full resize-none rounded-2xl border border-white/10 bg-black/35 p-4 font-mono text-xs leading-5 text-white/70 outline-none"
            />
            <button
              type="button"
              onClick={onCopy}
              disabled={!encryptedConversationKey}
              className="mt-4 w-full rounded-2xl bg-fuchsia-500 px-4 py-3 font-black text-white transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
            >
              {copy.chat.copyPrivateKeyAction}
            </button>
          </>
        ) : (
          <>
            <textarea
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder={copy.chat.addPrivateKeyPlaceholder}
              className="mt-5 h-40 w-full resize-none rounded-2xl border border-white/10 bg-black/35 p-4 font-mono text-xs leading-5 text-white/70 outline-none transition focus:border-fuchsia-300/60"
            />
            <button
              type="button"
              onClick={onImport}
              disabled={saving || !input.trim()}
              className="mt-4 w-full rounded-2xl bg-fuchsia-500 px-4 py-3 font-black text-white transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
            >
              {saving
                ? copy.chat.addPrivateKeySaving
                : copy.chat.addPrivateKeyAction}
            </button>
          </>
        )}
        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">
            {error}
          </div>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
