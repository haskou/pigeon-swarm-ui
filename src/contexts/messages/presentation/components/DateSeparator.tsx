export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="my-3 flex items-center gap-2.5">
      <div className="h-px flex-1 bg-white/10" />
      <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/40">
        {label}
      </div>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}
