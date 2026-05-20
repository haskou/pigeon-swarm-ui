import type { ReactNode } from 'react';

import { cx } from '../classNameHelper';

export function MetricCard({
  className,
  icon,
  label,
  onClick,
  value,
  variant = 'glass',
}: {
  className?: string;
  icon?: ReactNode;
  label: string;
  onClick?: () => void;
  value: string;
  variant?: 'dark' | 'glass' | 'inspector';
}) {
  const content = icon ? (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-white/75">
          {icon}
        </div>
        <div className="text-4xl font-black">{value}</div>
      </div>
      <div className="mt-2 text-sm text-white/45">{label}</div>
    </>
  ) : (
    <>
      <div className="text-xs font-black uppercase tracking-[.2em] text-white/40">
        {label}
      </div>
      <div className="mt-2 truncate text-lg font-black">{value}</div>
    </>
  );
  const cardClassName = cx(
    variant === 'dark'
      ? 'rounded-2xl bg-black/20 p-3'
      : variant === 'inspector'
        ? 'rounded-2xl bg-white/8 p-4'
        : 'glass-card rounded-2xl p-4',
    onClick && 'text-left transition hover:bg-white/10',
    className,
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cardClassName}>
        {content}
      </button>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}
