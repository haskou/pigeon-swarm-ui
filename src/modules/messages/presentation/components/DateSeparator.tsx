export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-white/10" />
      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/40">
        {label}
      </div>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}
