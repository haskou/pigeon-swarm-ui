import { cx } from '../../utils/classNameHelper';

interface RailProps {
  className?: string;
}

export function Rail({ className }: RailProps) {
  return (
    <aside
      className={cx(
        'glass-panel flex h-full flex-col items-center rounded-none p-3 sm:rounded-[2rem]',
        className,
      )}
    >
      <img
        src="/logo.png"
        alt="Pigeon Swarm"
        className="h-14 w-14 rounded-2xl shadow-xl"
      />
    </aside>
  );
}
