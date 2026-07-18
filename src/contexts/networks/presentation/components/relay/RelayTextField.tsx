export function RelayTextField({
  body,
  disabled,
  label,
  onChange,
  placeholder,
  value,
}: {
  body?: string;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-black text-white/70">
        {label}
      </span>
      {body ? (
        <span className="mb-2 block max-w-2xl text-xs leading-5 text-white/40">
          {body}
        </span>
      ) : null}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        type="text"
        className="ui-field-control px-4 py-3 text-sm placeholder:text-white/30"
        placeholder={placeholder}
        autoComplete="off"
      />
    </label>
  );
}
