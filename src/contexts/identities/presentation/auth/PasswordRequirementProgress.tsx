import type { ReactElement } from 'react';

import { cx } from '../../../../shared/presentation/cx';
import {
  passwordRequirement,
  type PasswordRequirementChecks,
} from './PasswordRequirement';

type PasswordRequirementProgressProps = {
  checks: PasswordRequirementChecks;
  className?: string;
};

export function PasswordRequirementProgress({
  checks,
  className,
}: PasswordRequirementProgressProps): ReactElement {
  const progress = passwordRequirement(checks);
  const percentage = Math.round((progress.complete / progress.total) * 100);

  return (
    <div
      className={cx(
        'rounded-2xl border border-white/10 bg-black/20 p-3',
        className,
      )}
    >
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={cx(
            'h-full rounded-full transition-[width,background-color]',
            progress.complete === progress.total
              ? 'bg-emerald-300'
              : 'bg-gradient-to-r from-cyan-300 to-fuchsia-500',
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p
        className={cx(
          'mt-2 text-xs font-bold leading-snug',
          progress.complete === progress.total
            ? 'text-emerald-200'
            : 'text-white/65',
        )}
        aria-live="polite"
      >
        {progress.message}
      </p>
    </div>
  );
}
