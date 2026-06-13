import { cx } from '../cx';

export type SegmentOption<TValue extends string> = {
  label: string;
  value: TValue;
};

interface SegmentedControlProps<TValue extends string> {
  columns?: 2 | 3;
  'data-testid'?: string;
  dense?: boolean;
  className?: string;
  onChange: (value: TValue) => void;
  options: Array<SegmentOption<TValue>>;
  value: TValue;
}

export function SegmentedControl<TValue extends string>({
  className,
  columns = 2,
  dense = false,
  'data-testid': testId,
  onChange,
  options,
  value,
}: SegmentedControlProps<TValue>) {
  return (
    <div
      className={cx(
        'grid gap-2 rounded-2xl bg-black/20 p-1',
        columns === 3 ? 'grid-cols-3' : 'grid-cols-2',
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
            'rounded-2xl font-black transition',
            dense
              ? 'px-2 py-3 text-xs leading-tight sm:px-3 sm:text-sm'
              : 'px-3 py-3 text-sm leading-none sm:px-4',
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
