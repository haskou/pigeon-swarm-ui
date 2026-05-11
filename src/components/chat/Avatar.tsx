import { cx } from '../../utils/classNameHelper';

interface AvatarProps {
  label: string;
  mine?: boolean;
  onClick?: () => void;
  picture?: string | null;
}

export function Avatar({ label, mine, onClick, picture }: AvatarProps) {
  const className = cx(
    'mt-1 grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-sm font-black text-slate-950',
    mine && 'ring-2 ring-white/40',
  );

  const content = picture ? (
    <img src={picture} alt="" className="h-full w-full object-cover" />
  ) : (
    label.slice(0, 1).toUpperCase()
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
