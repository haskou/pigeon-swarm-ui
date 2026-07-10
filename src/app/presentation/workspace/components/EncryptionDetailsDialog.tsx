import { useState } from 'react';
import { createPortal } from 'react-dom';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { cx } from '../../../../shared/presentation/cx';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';

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
        className="app-overlay-surface app-safe-area-panel ui-dialog-surface relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden sm:h-auto sm:max-h-[84vh] sm:max-w-2xl"
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-label={details.title}
      >
        <DialogHeader
          description={details.subtitle}
          title={details.title}
          onClose={close}
        />

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          <div
            className={cx(
              'ui-inline-notice text-sm font-bold',
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
            <p className="mt-3 border-l-2 border-white/15 pl-3 text-sm leading-6 text-white/55">
              {details.note}
            </p>
          )}

          <div className="mt-4 divide-y divide-white/10 border-y border-white/10">
            {details.rows.map((row) => (
              <div
                key={row.label}
                className="flex min-w-0 items-center justify-between gap-3 py-3 text-sm"
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
              <div className="divide-y divide-white/10 border-y border-white/10">
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
    if (
      secret.sensitive &&
      !window.confirm(copy.profile.copySensitiveKeyConfirm)
    ) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="flex min-w-0 items-center gap-3 py-3 text-xs">
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
          className="ui-button min-h-8 shrink-0 px-2.5 py-1 text-xs"
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
