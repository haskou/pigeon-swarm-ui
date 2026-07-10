import { createPortal } from 'react-dom';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';

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
  const { close, state } = useCloseTransition(onClose);

  useCloseOnEscape(close);

  return createPortal(
    <div
      className="app-overlay-scrim fixed inset-0 z-[100] grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4"
      data-state={state}
    >
      <button
        type="button"
        className="absolute inset-0"
        onClick={close}
        aria-label={copy.dialog.close}
      />
      <section
        className="app-overlay-surface app-safe-area-panel ui-dialog-surface relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden sm:h-auto sm:max-h-[84vh] sm:max-w-xl"
        data-state={state}
      >
        <DialogHeader
          description={
            isCopy ? copy.chat.copyPrivateKeyBody : copy.chat.addPrivateKeyBody
          }
          title={
            isCopy
              ? copy.chat.copyPrivateKeyTitle
              : copy.chat.addPrivateKeyTitle
          }
          onClose={close}
        />
        <div className="min-h-0 overflow-y-auto px-5 py-4">
          {isCopy ? (
            <>
              <textarea
                readOnly
                value={encryptedConversationKey}
                className="ui-field-control h-40 resize-none p-4 font-mono text-xs leading-5 text-white/70"
              />
              <button
                type="button"
                onClick={onCopy}
                disabled={!encryptedConversationKey}
                className="ui-button ui-button-primary mt-4 w-full"
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
                className="ui-field-control h-40 resize-none p-4 font-mono text-xs leading-5 text-white/70"
              />
              <button
                type="button"
                onClick={onImport}
                disabled={saving || !input.trim()}
                className="ui-button ui-button-primary mt-4 w-full"
              >
                {saving
                  ? copy.chat.addPrivateKeySaving
                  : copy.chat.addPrivateKeyAction}
              </button>
            </>
          )}
          {error ? (
            <div className="ui-inline-notice mt-4 border-rose-300/20 bg-rose-500/10 text-sm font-bold text-rose-100">
              {error}
            </div>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}
