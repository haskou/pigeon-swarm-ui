import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';

interface RailProps {
  onLogout: () => void;
}

export function Rail({ onLogout }: RailProps) {
  return (
    <aside className="hidden glass-panel rounded-[2rem] p-3 lg:flex lg:flex-col lg:items-center lg:gap-3">
      <img
        src="/logo.png"
        alt="Pigeon Swarm"
        className="h-14 w-14 rounded-2xl shadow-xl"
      />
      <div className="h-px w-10 bg-white/10" />
      {copy.workspace.rails.map((item, index) => (
        <button
          key={item}
          className={cx(
            'grid h-12 w-12 place-items-center rounded-2xl text-xs font-black transition',
            index === 0
              ? 'bg-white text-slate-950'
              : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white',
          )}
        >
          {item}
        </button>
      ))}
      <button
        onClick={onLogout}
        className="mt-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/15 text-xs font-black text-rose-100 hover:bg-rose-500/25"
      >
        {copy.workspace.logout}
      </button>
    </aside>
  );
}
