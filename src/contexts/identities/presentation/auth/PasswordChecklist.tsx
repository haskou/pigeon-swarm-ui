import type { ReactElement } from 'react';

import { copy } from '../../../../i18n/en';
import { cx } from '../../../../utils/classNameHelper';

interface PasswordChecklistProps {
  checks: {
    lowercase: boolean;
    match: boolean;
    maxLength: boolean;
    minLength: boolean;
    number: boolean;
    symbol: boolean;
    uppercase: boolean;
  };
  variant?: 'auth' | 'profile';
}

export function PasswordChecklist({
  checks,
  variant = 'profile',
}: PasswordChecklistProps): ReactElement {
  const requirements =
    variant === 'auth'
      ? copy.auth.passwordRequirementItems
      : copy.profile.passwordRequirements;
  const items = [
    [requirements.minLength, checks.minLength],
    [requirements.maxLength, checks.maxLength],
    [requirements.uppercase, checks.uppercase],
    [requirements.lowercase, checks.lowercase],
    [requirements.number, checks.number],
    [requirements.symbol, checks.symbol],
    [requirements.match, checks.match],
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-1.5 text-[0.68rem] font-black sm:gap-2 sm:text-xs">
      {items.map(([label, complete]) => (
        <div
          key={label}
          className={cx(
            'flex min-w-0 items-center gap-1.5 rounded-2xl px-2.5 py-1.5 sm:gap-2 sm:px-3 sm:py-2',
            complete
              ? 'bg-emerald-400/10 text-emerald-200'
              : 'bg-white/5 text-white/45',
          )}
        >
          <span aria-hidden="true">{complete ? '✓' : '×'}</span>
          <span className="min-w-0 truncate">{label}</span>
        </div>
      ))}
    </div>
  );
}
