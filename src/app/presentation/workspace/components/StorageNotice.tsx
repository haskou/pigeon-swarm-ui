import { copy } from '../../../../shared/presentation/i18n/copy';

/** One dismissible line about this device's storage, shown once per unlock. */
export function StorageNotice({
  notice,
  onDismiss,
}: {
  notice: string | null;
  onDismiss: () => void;
}) {
  if (!notice) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+1rem)] z-[70] flex justify-center lg:top-5"
      role="status"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-amber-200/25 bg-[#171827]/95 p-3 shadow-2xl shadow-black/35 backdrop-blur">
        <p className="min-w-0 flex-1 text-xs leading-snug text-white/75">
          {notice}
        </p>
        <button
          className="shrink-0 rounded-xl px-3 py-1 text-xs font-black text-white/60 transition hover:bg-white/10 hover:text-white"
          onClick={onDismiss}
          type="button"
        >
          {copy.workspace.dismissNotice}
        </button>
      </div>
    </div>
  );
}
