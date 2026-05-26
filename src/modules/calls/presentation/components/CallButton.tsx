import type { MouseEvent, ReactNode } from 'react';

import { cx } from '../../../../shared/presentation/cx';

export function CallButton({
  active,
  badge,
  children,
  disabled = false,
  label,
  onClick,
}: {
  active: boolean;
  badge?: string;
  children: ReactNode;
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
        'relative grid h-11 w-11 place-items-center rounded-[1.15rem] transition',
        disabled
          ? 'cursor-not-allowed bg-white/5 text-white/30'
          : active
            ? 'bg-fuchsia-500 text-white hover:bg-fuchsia-400'
            : 'bg-white/10 text-white/75 hover:bg-white/15',
      )}
      aria-label={label}
      title={label}
    >
      <span className="[&>svg]:h-6 [&>svg]:w-6">{children}</span>
      {badge && (
        <span className="absolute -bottom-1 -right-1 rounded-full border border-[#151722] bg-emerald-300 px-1.5 text-[0.55rem] font-black leading-4 text-slate-950">
          {badge}
        </span>
      )}
    </button>
  );
}
