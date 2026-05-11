interface HeroMetricProps {
  label: string;
  onClick?: () => void;
  value: string;
}

export function HeroMetric({ label, onClick, value }: HeroMetricProps) {
  const content = (
    <>
      <div className="text-xs font-black uppercase tracking-[.2em] text-white/40">
        {label}
      </div>
      <div className="mt-2 truncate text-lg font-black">{value}</div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="glass-card rounded-3xl p-4 text-left transition hover:bg-white/10"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="glass-card rounded-3xl p-4">
      {content}
    </div>
  );
}
