import type { MouseEvent, ReactNode } from 'react';

import { cx } from '../../utils/classNameHelper';

export function CallButton({
  active,
  children,
  disabled = false,
  label,
  onClick,
}: {
  active: boolean;
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
        'grid h-9 w-9 place-items-center rounded-2xl transition',
        disabled
          ? 'cursor-not-allowed bg-white/5 text-white/30'
          : active
            ? 'bg-fuchsia-500 text-white hover:bg-fuchsia-400'
            : 'bg-white/10 text-white/75 hover:bg-white/15',
      )}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
