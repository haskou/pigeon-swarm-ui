interface HeroMetricProps {
  label: string;
  value: string;
}

export function HeroMetric({ label, value }: HeroMetricProps) {
  return (
    <div className="glass-card rounded-3xl p-4">
      <div className="text-xs font-black uppercase tracking-[.2em] text-white/40">
        {label}
      </div>
      <div className="mt-2 truncate text-lg font-black">{value}</div>
    </div>
  );
}
