import { copy } from '../../../../shared/presentation/i18n/copy';

export function DialogHeader({
  onClose,
  title,
}: {
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <h2 className="text-2xl font-black tracking-tight">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15"
        aria-label={copy.dialog.close}
      >
        ×
      </button>
    </div>
  );
}

export function VoiceIcon() {
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

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M9 4h6m-9 4h12m-10 0 .7 11h6.6L16 8M10 11v5m4-5v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
