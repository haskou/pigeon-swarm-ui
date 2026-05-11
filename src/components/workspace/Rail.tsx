import { cx } from '../../utils/classNameHelper';
import { copy } from '../../i18n/en';

interface RailProps {
  className?: string;
  notificationCount?: number;
  onNotificationsClick?: () => void;
}

export function Rail({
  className,
  notificationCount = 0,
  onNotificationsClick,
}: RailProps) {
  return (
    <aside
      className={cx(
        'glass-panel flex h-full flex-col items-center gap-3 rounded-none p-3 sm:rounded-[2rem]',
        className,
      )}
    >
      <img
        src="/logo.png"
        alt="Pigeon Swarm"
        className="h-14 w-14 rounded-2xl shadow-xl"
      />
      <button
        type="button"
        onClick={onNotificationsClick}
        className="relative grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white/75 transition hover:bg-white/15"
        aria-label={copy.notifications.open}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5"
        >
          <path
            d="M18 9.5a6 6 0 0 0-12 0v3.2L4.7 15a1 1 0 0 0 .9 1.5h12.8a1 1 0 0 0 .9-1.5L18 12.7V9.5Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <path
            d="M9.6 19a2.6 2.6 0 0 0 4.8 0"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
        {notificationCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-[0.65rem] font-black leading-none text-white">
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        )}
      </button>
    </aside>
  );
}
