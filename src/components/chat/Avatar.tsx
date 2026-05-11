import { cx } from '../../utils/classNameHelper';

interface AvatarProps {
  label: string;
  mine?: boolean;
}

export function Avatar({ label, mine }: AvatarProps) {
  return (
    <div
      className={cx(
        'mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-sm font-black',
        mine ? 'bg-white text-slate-950' : 'bg-white/10 text-white',
      )}
    >
      {label.slice(0, 1).toUpperCase()}
    </div>
  );
}
