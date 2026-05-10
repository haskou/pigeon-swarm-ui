interface PlaceholderRowProps {
  title: string;
  subtitle: string;
}

export function PlaceholderRow({ subtitle, title }: PlaceholderRowProps) {
  return (
    <div className="rounded-2xl bg-white/6 px-3 py-2">
      <div className="text-sm font-black"># {title}</div>
      <div className="text-xs text-white/40">{subtitle}</div>
    </div>
  );
}
