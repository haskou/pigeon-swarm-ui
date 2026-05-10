export function BackgroundGlow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-fuchsia-500/30 blur-3xl" />
      <div className="absolute right-0 top-1/4 h-[34rem] w-[34rem] rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-indigo-500/25 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,.10),transparent_35%)]" />
    </div>
  );
}
