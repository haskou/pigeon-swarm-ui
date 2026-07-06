import { useState } from 'react';
import { createPortal } from 'react-dom';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { cx } from '../../../../shared/presentation/cx';

export type EncryptionDetailsSecret = {
  label: string;
  sensitive?: boolean;
  value?: null | string;
};

export type EncryptionDetailsRow = {
  label: string;
  value: string;
};

export type EncryptionDetails = {
  note?: string;
  rows: EncryptionDetailsRow[];
  secrets: EncryptionDetailsSecret[];
  status: 'missing' | 'public' | 'ready';
  subtitle?: string;
  title: string;
};

export function EncryptionDetailsDialog({
  details,
  onClose,
}: {
  details: EncryptionDetails;
  onClose: () => void;
}) {
  const { close, state } = useCloseTransition(onClose);

  useCloseOnEscape(close);

  return createPortal(
    <div
      className="app-overlay-scrim fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-md"
      data-state={state}
    >
      <button
        type="button"
        className="absolute inset-0"
        onClick={close}
        aria-label={copy.dialog.close}
      />
      <section
        className="app-overlay-surface glass-panel-strong relative z-10 flex max-h-[84vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl p-5 shadow-2xl shadow-black/40"
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-label={details.title}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-black text-white">{details.title}</h2>
            {details.subtitle && (
              <p className="mt-1 truncate text-sm font-semibold text-white/45">
                {details.subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15"
            aria-label={copy.dialog.close}
          >
            &times;
          </button>
        </div>

        <div className="mt-4 min-h-0 overflow-y-auto pr-1">
          <div
            className={cx(
              'rounded-2xl border px-3 py-2 text-sm font-black',
              details.status === 'ready' &&
                'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
              details.status === 'public' &&
                'border-amber-300/20 bg-amber-300/10 text-amber-100',
              details.status === 'missing' &&
                'border-rose-300/20 bg-rose-500/10 text-rose-100',
            )}
          >
            {statusLabel(details.status)}
          </div>

          {details.note && (
            <p className="mt-3 rounded-2xl bg-white/[0.06] p-3 text-sm leading-6 text-white/55">
              {details.note}
            </p>
          )}

          <div className="mt-4 grid gap-2">
            {details.rows.map((row) => (
              <div
                key={row.label}
                className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-black/25 px-3 py-2 text-sm"
              >
                <span className="text-white/45">{row.label}</span>
                <span className="min-w-0 truncate font-black text-white/75">
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {details.secrets.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
                {copy.encryption.keys}
              </div>
              <div className="grid gap-2">
                {details.secrets.map((secret) => (
                  <SecretRow key={secret.label} secret={secret} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function SecretRow({ secret }: { secret: EncryptionDetailsSecret }) {
  const [copied, setCopied] = useState(false);
  const value = secret.value?.trim();

  const copyValue = async () => {
    if (!value || !navigator.clipboard) return;

    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-black/25 p-2 text-xs">
      <div className="min-w-0 flex-1">
        <div className="font-black text-white/70">{secret.label}</div>
        <div className="mt-1 truncate font-semibold text-white/40">
          {value ? maskedValue(value, secret.sensitive) : copy.encryption.empty}
        </div>
      </div>
      {value && (
        <button
          type="button"
          onClick={() => void copyValue()}
          className="shrink-0 rounded-xl bg-white/10 px-2.5 py-1.5 font-black text-white/65 transition hover:bg-white/15 hover:text-white"
        >
          {copied ? copy.profile.copied : copy.profile.copy}
        </button>
      )}
    </div>
  );
}

function maskedValue(value: string, sensitive?: boolean): string {
  if (!sensitive) return value;

  return '••••••••••••••••••••••••';
}

function statusLabel(status: EncryptionDetails['status']): string {
  if (status === 'ready') return copy.encryption.ready;
  if (status === 'public') return copy.encryption.public;

  return copy.encryption.missing;
}
