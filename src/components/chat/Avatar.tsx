import { cx } from '../../utils/classNameHelper';

interface AvatarProps {
  label: string;
  mine?: boolean;
  picture?: string | null;
}

export function Avatar({ label, mine, picture }: AvatarProps) {
  return (
    <div
      className={cx(
        'mt-1 grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl text-sm font-black',
        mine ? 'bg-white text-slate-950' : 'bg-white/10 text-white',
      )}
    >
      {picture ? (
        <img src={picture} alt="" className="h-full w-full object-cover" />
      ) : (
        label.slice(0, 1).toUpperCase()
      )}
    </div>
  );
}
