import type { ReactElement } from 'react';

import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';

export function AuthSwitch({ enabled }: { enabled: boolean }): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex h-6 w-11 shrink-0 items-center rounded-full border border-white/10 transition-colors',
        enabled ? 'bg-cyan-400/25' : 'bg-black/25',
      )}
    >
      <span
        className={cx(
          'h-4 w-4 rounded-full bg-white transition-transform',
          enabled ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </span>
  );
}

export function PasskeyPrfUnavailableNotice({
  children,
}: {
  children: string;
}): ReactElement {
  return (
    <div
      data-testid="auth-passkey-prf-warning"
      className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-xs leading-snug text-amber-50/80"
    >
      {children}
    </div>
  );
}

export function RecoveryKeyPanel({
  confirmed,
  onConfirmedChange,
  onRegenerate,
  recoveryKey,
}: {
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  onRegenerate: () => void;
  recoveryKey: string;
}): ReactElement {
  return (
    <section className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-black text-amber-50">
            {copy.auth.recoveryKeyTitle}
          </h2>
          <p className="mt-1 text-xs leading-snug text-amber-50/70">
            {copy.auth.recoveryKeyCreateHelp}
          </p>
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white/75 transition hover:bg-white/15"
        >
          {copy.auth.recoveryKeyRegenerate}
        </button>
      </div>
      <textarea
        readOnly
        value={recoveryKey}
        className="mt-3 h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-3 font-mono text-xs text-white outline-none"
        data-testid="auth-recovery-key-output"
      />
      <button
        type="button"
        aria-pressed={confirmed}
        onClick={() => onConfirmedChange(!confirmed)}
        className="mt-3 flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left text-sm font-bold text-white/75"
        data-testid="auth-recovery-key-confirm"
      >
        <AuthSwitch enabled={confirmed} />
        <span>{copy.auth.recoveryKeySaved}</span>
      </button>
    </section>
  );
}

type PasswordRequirementProgressProps = {
  complete: number;
  message: string;
  total: number;
};

export function PasswordRequirementProgress({
  complete,
  message,
  total,
}: PasswordRequirementProgressProps): ReactElement {
  const percentage = total > 0 ? Math.round((complete / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={cx(
            'h-full rounded-full transition-[width,background-color]',
            complete === total
              ? 'bg-emerald-300'
              : 'bg-gradient-to-r from-cyan-300 to-fuchsia-500',
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p
        className={cx(
          'mt-2 text-xs font-bold leading-snug',
          complete === total ? 'text-emerald-200' : 'text-white/55',
        )}
      >
        {message}
      </p>
    </div>
  );
}

type PasswordRequirementProgressInput = {
  checks: {
    lowercase: boolean;
    match: boolean;
    maxLength: boolean;
    minLength: boolean;
    number: boolean;
    symbol: boolean;
    uppercase: boolean;
  };
};

export function createPasswordRequirementProgress({
  checks,
}: PasswordRequirementProgressInput): PasswordRequirementProgressProps {
  const values = Object.values(checks);

  return {
    complete: values.filter(Boolean).length,
    message: nextPasswordRequirementMessage(checks),
    total: values.length,
  };
}

function nextPasswordRequirementMessage(
  checks: PasswordRequirementProgressInput['checks'],
): string {
  if (!checks.uppercase) return copy.auth.passwordRequirementNext.uppercase;
  if (!checks.number) return copy.auth.passwordRequirementNext.number;
  if (!checks.symbol) return copy.auth.passwordRequirementNext.symbol;
  if (!checks.match) return copy.auth.passwordRequirementNext.match;
  if (Object.values(checks).every(Boolean)) {
    return copy.auth.passwordRequirementNext.valid;
  }

  return copy.auth.passwordRequirements;
}
