import { cx } from '../../utils/classNameHelper';
import { copy } from '../../i18n/en';

interface RailProps {
  className?: string;
  notificationCount?: number;
  onNotificationsClick?: () => void;
  onSettingsClick?: () => void;
  settingsAttention?: boolean;
}

export function Rail({
  className,
  notificationCount = 0,
  onNotificationsClick,
  onSettingsClick,
  settingsAttention = false,
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
      <button
        type="button"
        onClick={onSettingsClick}
        className="relative mt-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white/75 transition hover:bg-white/15"
        aria-label={copy.nodeSettings.open}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5"
        >
          <path
            d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M19 13.2v-2.4l-2.1-.5a5.8 5.8 0 0 0-.6-1.4l1.1-1.9-1.7-1.7-1.9 1.1a5.8 5.8 0 0 0-1.4-.6L12 3.7H9.6L9.1 5.8a5.8 5.8 0 0 0-1.4.6L5.8 5.3 4.1 7l1.1 1.9a5.8 5.8 0 0 0-.6 1.4l-2.1.5v2.4l2.1.5c.1.5.4 1 .6 1.4L4.1 17l1.7 1.7 1.9-1.1c.4.3.9.5 1.4.6l.5 2.1H12l.5-2.1c.5-.1 1-.4 1.4-.6l1.9 1.1 1.7-1.7-1.1-1.9c.3-.4.5-.9.6-1.4l2-.5Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
        {settingsAttention && (
          <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-[#1b1d38] bg-fuchsia-500" />
        )}
      </button>
    </aside>
  );
}
