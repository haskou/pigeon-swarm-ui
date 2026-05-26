import type { ReactNode } from 'react';

import { cx } from '../../../../shared/presentation/cx';

export function CallVolumeControl({
  className,
  disabled = false,
  icon,
  iconClassName = 'text-white/70',
  inputClassName,
  label,
  onChange,
  stopPropagation = false,
  value,
  valueClassName = 'text-white/85',
}: {
  className?: string;
  disabled?: boolean;
  icon: ReactNode;
  iconClassName?: string;
  inputClassName?: string;
  label: string;
  onChange: (nextVolume: number) => void;
  stopPropagation?: boolean;
  value: number;
  valueClassName?: string;
}) {
  return (
    <label
      className={cx(
        'w-full min-w-0 text-left text-[0.65rem] font-black text-white/55',
        className,
      )}
      onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
      onPointerDown={
        stopPropagation ? (event) => event.stopPropagation() : undefined
      }
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cx('shrink-0', iconClassName)}>{icon}</span>
          <span className="truncate">{label}</span>
        </span>
        <span className={valueClassName}>{value}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={300}
        step={5}
        value={disabled ? 100 : value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className={cx(
          'mt-2 h-2 w-full accent-emerald-300 disabled:cursor-not-allowed disabled:opacity-35',
          inputClassName,
        )}
      />
    </label>
  );
}
