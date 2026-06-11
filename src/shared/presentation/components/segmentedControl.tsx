import { cx } from '../cx';

export type SegmentOption<TValue extends string> = {
  label: string;
  value: TValue;
};

interface SegmentedControlProps<TValue extends string> {
  'data-testid'?: string;
  className?: string;
  onChange: (value: TValue) => void;
  options: Array<SegmentOption<TValue>>;
  value: TValue;
}

export function SegmentedControl<TValue extends string>({
  className,
  'data-testid': testId,
  onChange,
  options,
  value,
}: SegmentedControlProps<TValue>) {
  return (
    <div
      className={cx(
        'grid grid-cols-2 gap-2 rounded-2xl bg-black/20 p-1',
        className,
      )}
      data-testid={testId}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cx(
            'rounded-2xl px-3 py-3 text-sm font-black leading-none transition sm:px-4',
            value === option.value
              ? 'bg-white text-slate-950'
              : 'text-white/60 hover:text-white',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
