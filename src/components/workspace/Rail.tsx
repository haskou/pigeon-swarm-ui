import { cx } from '../../utils/classNameHelper';
import { copy } from '../../i18n/en';

interface RailProps {
  className?: string;
  notificationCount?: number;
  onInspectorClick?: () => void;
  onNotificationsClick?: () => void;
  onSettingsClick?: () => void;
  peerCount?: number;
  settingsAttention?: boolean;
}

export function Rail({
  className,
  notificationCount = 0,
  onInspectorClick,
  onNotificationsClick,
  onSettingsClick,
  peerCount = 0,
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
      {onInspectorClick && (
        <button
          type="button"
          onClick={onInspectorClick}
          className="relative mt-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white/75 transition hover:bg-white/15"
          aria-label={copy.inspector.open}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="h-5 w-5"
          >
            <path
              d="M5 6.5h14M5 12h10M5 17.5h7"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
            />
          </svg>
          {peerCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-[0.65rem] font-black leading-none text-white">
              {peerCount > 9 ? '9+' : peerCount}
            </span>
          )}
        </button>
      )}
      <button
        type="button"
        onClick={onSettingsClick}
        className={cx(
          'relative grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white/75 transition hover:bg-white/15',
          !onInspectorClick && 'mt-auto',
        )}
        aria-label={copy.nodeSettings.open}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5"
        >
          <path
            d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M19.35 13.15v-2.3l-2.05-.42a5.8 5.8 0 0 0-.58-1.4l1.15-1.75-1.62-1.62-1.75 1.15a5.8 5.8 0 0 0-1.4-.58L12.7 4h-2.3l-.4 2.05a5.8 5.8 0 0 0-1.42.58L6.85 5.48 5.23 7.1l1.15 1.75a5.8 5.8 0 0 0-.58 1.4l-2.05.42v2.3l2.05.42c.12.5.32.98.58 1.4l-1.15 1.75 1.62 1.62 1.75-1.15c.44.26.92.46 1.42.58l.4 2.05h2.3l.4-2.05c.5-.12.98-.32 1.4-.58l1.75 1.15 1.62-1.62-1.15-1.75c.26-.44.46-.92.58-1.4l2.03-.24Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeLinecap="round"
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
