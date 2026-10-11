import { useState } from 'react';
import { createPortal } from 'react-dom';

import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { cx } from '../../../../shared/presentation/cx';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  type ContactVerification,
  useSafetyNumber,
} from '../hooks/useContactVerification';

export function ContactVerificationDialog({
  localIdentityId,
  name,
  onClose,
  peerIdentityId,
  verification,
}: {
  localIdentityId: string;
  name: string;
  onClose: () => void;
  peerIdentityId: string;
  verification: ContactVerification;
}) {
  const { close, state } = useCloseTransition(onClose);
  const safetyNumber = useSafetyNumber(localIdentityId, peerIdentityId);
  const [error, setError] = useState<string | null>(null);

  useCloseOnEscape(close);

  const toggleVerification = () => {
    const saved = verification.verified
      ? verification.removeVerification()
      : verification.markVerified();

    setError(saved ? null : copy.contacts.saveError);
  };

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
        className="app-overlay-surface app-safe-area-panel ui-dialog-surface relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden sm:h-auto sm:max-h-[84vh] sm:max-w-lg"
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-label={copy.contacts.verifyTitle}
      >
        <DialogHeader title={copy.contacts.verifyTitle} onClose={close} />

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          <p className="text-sm leading-6 text-white/70">
            {copy.contacts.verifyBody.replace('{name}', name)}
          </p>

          <div
            role="group"
            aria-label={copy.contacts.safetyNumber}
            className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4"
          >
            {(safetyNumber ?? []).map((group, index) => (
              <span
                key={index}
                className="rounded-xl border border-white/10 bg-white/[0.04] py-2 text-center font-mono text-sm tracking-wider text-white/85"
              >
                {group}
              </span>
            ))}
          </div>

          <div
            className={cx(
              'ui-inline-notice mt-4 text-sm font-bold',
              verification.verified
                ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                : 'border-amber-300/20 bg-amber-300/10 text-amber-100',
            )}
          >
            {verification.verified
              ? copy.contacts.verifiedStatus
              : copy.contacts.unverifiedStatus}
          </div>

          <p className="mt-3 text-xs leading-5 text-white/50">
            {copy.contacts.verifyHelp}
          </p>

          {error && (
            <p className="mt-3 text-sm text-rose-200" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-white/10 px-5 py-4">
          <button
            type="button"
            className={cx(
              'ui-button',
              !verification.verified && 'ui-button-primary',
            )}
            onClick={toggleVerification}
          >
            {verification.verified
              ? copy.contacts.removeVerification
              : copy.contacts.markVerified}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
