import { cx } from '../../../../../shared/presentation/cx';

export function RelaySwitchField({
  body,
  checked,
  disabled,
  label,
  onChange,
}: {
  body: string;
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-4 text-sm text-white/75">
      <span className="min-w-0">
        <span className="block font-black">{label}</span>
        <span className="mt-1 block text-xs font-normal leading-5 text-white/40">
          {body}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cx(
          'relative h-6 w-11 shrink-0 rounded-full border transition',
          checked
            ? 'border-cyan-200/35 bg-cyan-400/75'
            : 'border-white/12 bg-white/10',
          disabled && 'opacity-45',
        )}
      >
        <span
          className={cx(
            'absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition',
            checked ? 'left-[1.3rem]' : 'left-0.5',
          )}
        />
      </span>
    </label>
  );
}
