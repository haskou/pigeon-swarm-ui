import type { MouseEvent, ReactNode } from 'react';

import { cx } from '../../../../shared/presentation/cx';

export function CallButton({
  active,
  badge,
  blocked = false,
  children,
  compact = false,
  disabled = false,
  label,
  onClick,
}: {
  active: boolean;
  badge?: string;
  blocked?: boolean;
  children: ReactNode;
  compact?: boolean;
  disabled?: boolean;
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={cx(
        'relative grid h-10 w-10 place-items-center rounded-xl transition',
        !compact && 'sm:h-11 sm:w-11 sm:rounded-[1.15rem]',
        callButtonTone({ active, blocked, disabled }),
      )}
      aria-label={label}
      title={label}
    >
      <span
        className={cx(
          '[&>svg]:h-5 [&>svg]:w-5',
          !compact && 'sm:[&>svg]:h-6 sm:[&>svg]:w-6',
        )}
      >
        {children}
      </span>
      {badge && (
        <span className="absolute -bottom-1 -right-1 rounded-full border border-[#151722] bg-emerald-300 px-1.5 text-[0.55rem] font-black leading-4 text-slate-950">
          {badge}
        </span>
      )}
      {blocked && (
        <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-[#151722] bg-amber-300 text-[0.6rem] font-black leading-none text-slate-950">
          !
        </span>
      )}
    </button>
  );
}

function callButtonTone({
  active,
  blocked,
  disabled,
}: {
  active: boolean;
  blocked: boolean;
  disabled: boolean;
}): string {
  if (blocked) {
    return 'cursor-not-allowed bg-amber-300/15 text-amber-100 ring-1 ring-amber-300/30';
  }

  if (disabled) return 'cursor-not-allowed bg-white/5 text-white/30';

  return active
    ? 'bg-fuchsia-500 text-white hover:bg-fuchsia-400'
    : 'bg-white/10 text-white/75 hover:bg-white/15';
}
