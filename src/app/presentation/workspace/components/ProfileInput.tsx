import { cx } from '../../../../shared/presentation/cx';

export const profileEditorInputClass =
  'ui-field-control px-4 py-3 placeholder:text-white/30';

export function ProfileInput({
  label,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-black text-white/70">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        className={cx(profileEditorInputClass, 'text-sm font-normal')}
      />
    </label>
  );
}
