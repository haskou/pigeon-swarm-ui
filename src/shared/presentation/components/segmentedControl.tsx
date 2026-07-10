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
        'grid overflow-hidden rounded-lg border border-white/10 bg-black/15',
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
            'border-r border-white/10 font-bold transition last:border-r-0',
            dense
              ? 'px-2 py-2.5 text-xs leading-tight sm:px-3 sm:text-sm'
              : 'px-3 py-3 text-sm leading-none sm:px-4',
            value === option.value
              ? 'bg-cyan-300/12 text-cyan-100 shadow-[inset_0_-2px_0_rgba(103,232,249,.65)]'
              : 'text-white/55 hover:bg-white/[0.04] hover:text-white',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
