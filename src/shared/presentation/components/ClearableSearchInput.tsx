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
          'ui-field-control w-full py-2 pl-9 pr-9 text-sm placeholder:text-white/30',
          inputClassName,
        )}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="ui-icon-button absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 text-white/45"
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
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="m20 20-4.4-4.4M17.5 10.75a6.75 6.75 0 1 1-13.5 0 6.75 6.75 0 0 1 13.5 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
