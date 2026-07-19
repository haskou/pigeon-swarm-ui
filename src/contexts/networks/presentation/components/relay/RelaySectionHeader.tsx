export function RelaySectionHeader({
  body,
  title,
}: {
  body: string;
  title: string;
}) {
  return (
    <div className="mb-3">
      <div className="text-base font-black text-white/85">{title}</div>
      <p className="mt-1 text-sm leading-6 text-white/50">{body}</p>
    </div>
  );
}
