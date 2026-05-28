import { cx } from '../cx';

export function ClearableSearchInput({
  ariaLabel,
  className,
  clearLabel,
  inputClassName,
  onChange,
  placeholder,
  value,
}: {
  ariaLabel: string;
  className?: string;
  clearLabel: string;
  inputClassName?: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div className={cx('relative', className)}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
      >
        <SearchIcon />
      </span>
      <input
        type="text"
        role="searchbox"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cx(
          'w-full rounded-2xl border border-white/10 bg-black/25 py-2 pl-9 pr-9 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60',
          inputClassName,
        )}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
          aria-label={clearLabel}
        >
          ×
        </button>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="m20 20-4.4-4.4M17.5 10.75a6.75 6.75 0 1 1-13.5 0 6.75 6.75 0 0 1 13.5 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
