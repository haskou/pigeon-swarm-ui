function toOptionalPort(value: string): number | undefined {
  if (!value.trim()) return undefined;

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) return undefined;

  return port;
}

export function RelayNumberField({
  body,
  disabled,
  label,
  max,
  min,
  onChange,
  value,
}: {
  body?: string;
  disabled?: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number | undefined) => void;
  value?: number;
}) {
  return (
    <label className="flex h-full flex-col">
      <span className="mb-1 block text-sm font-black text-white/70">
        {label}
      </span>
      {body ? (
        <span className="mb-2 block text-xs leading-5 text-white/40 sm:min-h-10">
          {body}
        </span>
      ) : null}
      <input
        value={value ?? ''}
        onChange={(event) => onChange(toOptionalPort(event.target.value))}
        disabled={disabled}
        min={min}
        max={max}
        type="number"
        inputMode="numeric"
        className="ui-field-control mt-auto px-4 py-3 text-sm placeholder:text-white/30"
      />
    </label>
  );
}
