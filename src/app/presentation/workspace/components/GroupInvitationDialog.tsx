import type { FormEvent } from 'react';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';

interface GroupInvitationDialogProps {
  autoFocus: boolean;
  error: string | null;
  input: string;
  loading: boolean;
  onClose: () => void;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function GroupInvitationDialog({
  autoFocus,
  error,
  input,
  loading,
  onClose,
  onInputChange,
  onSubmit,
}: GroupInvitationDialogProps) {
  useCloseOnEscape(onClose);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <form
        onSubmit={onSubmit}
        className="app-safe-area-fullscreen-surface glass-panel-strong relative z-10 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden rounded-none shadow-2xl shadow-black/40 sm:h-[92vh] sm:max-h-[92vh] sm:max-w-3xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight">
              {copy.chat.invite}
            </h2>
            <p className="mt-1 text-sm text-white/50">
              {copy.chat.inviteGroupBody}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15"
            aria-label={copy.dialog.close}
          >
            ×
          </button>
        </div>
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <label className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
              {copy.identityLookup.label}
            </label>
            <input
              autoFocus={autoFocus}
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
              placeholder={copy.identityLookup.placeholder}
            />
            {error && (
              <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-xs text-rose-100">
                {error}
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end border-t border-white/10 pt-4">
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="rounded-2xl bg-fuchsia-500 px-5 py-3 text-sm font-black text-white transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {copy.chat.sendInvite}
          </button>
        </div>
      </form>
    </div>
  );
}
