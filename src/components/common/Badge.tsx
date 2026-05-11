interface BadgeProps {
  label: string;
}

export function Badge({ label }: BadgeProps) {
  return (
    <span className="rounded-full bg-white/10 px-3 py-1 text-center font-black text-white/70">
      {label}
    </span>
  );
}
