interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export function Field({ children, label }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[.22em] text-white/45">
        {label}
      </span>
      {children}
    </label>
  );
}
