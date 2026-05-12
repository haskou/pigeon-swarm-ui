import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { cx } from '../../utils/classNameHelper';

export type GlassSelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

interface GlassSelectProps {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  options: GlassSelectOption[];
  value: string;
}

export function GlassSelect({
  ariaLabel,
  className,
  disabled = false,
  onChange,
  options,
  value,
}: GlassSelectProps) {
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption =
    options.find((option) => option.value === value) ??
    options.find((option) => !option.disabled);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointerDown);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
    };
  }, [open]);

  const selectOption = (nextValue: string) => {
    const option = options.find((item) => item.value === nextValue);

    if (!option || option.disabled) return;

    onChange(nextValue);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (disabled) return;

      setOpen((isOpen) => !isOpen);
      return;
    }

    const selectedIndex = Math.max(
      options.findIndex((option) => option.value === selectedOption?.value),
      0,
    );

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (options.length === 0) return;

      const offset = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = nextEnabledOptionIndex(options, selectedIndex, offset);

      if (nextIndex < 0) return;

      selectOption(options[nextIndex].value);
    }
  };

  return (
    <div ref={rootRef} className={cx('relative', className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((isOpen) => !isOpen)}
        onKeyDown={handleKeyDown}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-left text-sm font-bold text-white outline-none transition hover:border-white/20 focus:border-cyan-300/60 focus:bg-black/35 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <span className="min-w-0 truncate">
          {selectedOption?.label ?? ariaLabel}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className={cx(
            'h-5 w-5 shrink-0 text-white/50 transition-transform',
            open && 'rotate-180',
          )}
        >
          <path
            d="M5 8l5 5 5-5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 top-[calc(100%+.5rem)] z-30 overflow-hidden rounded-2xl border border-white/12 bg-[#0c102b]/95 p-1 shadow-2xl shadow-black/45 backdrop-blur-xl"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled}
              disabled={option.disabled}
              onClick={() => selectOption(option.value)}
              className={cx(
                'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold outline-none transition',
                option.disabled
                  ? 'cursor-not-allowed text-white/25'
                  : option.value === value
                  ? 'bg-white text-slate-950'
                  : 'text-white/70 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white',
              )}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-4 w-4 shrink-0"
                >
                  <path
                    d="M4.5 10.5 8 14l7.5-8"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function nextEnabledOptionIndex(
  options: GlassSelectOption[],
  selectedIndex: number,
  offset: number,
): number {
  for (let step = 1; step <= options.length; step += 1) {
    const nextIndex =
      (selectedIndex + offset * step + options.length) % options.length;

    if (!options[nextIndex].disabled) return nextIndex;
  }

  return -1;
}
