import type { ReactNode } from 'react';

import type { NotificationScopeSetting } from '../../../../shared/domain/pigeonResources.types';

import { NotificationSettingsPolicy } from '../../domain/NotificationSettingsPolicy';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { MutedNotificationsIcon } from '../../../../shared/presentation/components/MutedNotificationsIcon';

type NotificationScopeMenuActionsVariant = 'block' | 'compact';

type NotificationScopeMenuActionsProps = {
  muteLabel: string;
  notificationSetting: NotificationScopeSetting;
  onNotificationMuteToggle: () => void;
  onNotificationSettingsOpen: () => void;
  variant?: NotificationScopeMenuActionsVariant;
};

export function NotificationScopeMenuActions({
  muteLabel,
  notificationSetting,
  onNotificationMuteToggle,
  onNotificationSettingsOpen,
  variant = 'block',
}: NotificationScopeMenuActionsProps) {
  const muted = NotificationSettingsPolicy.isMuted(notificationSetting);
  const muteActionLabel = muted ? copy.notifications.unmute : muteLabel;
  const actionClassName =
    variant === 'compact'
      ? 'rounded-xl px-3 py-2 text-sm font-semibold'
      : 'rounded-2xl px-3 py-2 font-black';

  return (
    <>
      <NotificationScopeMenuButton
        className={actionClassName}
        icon={
          muted ? (
            <NotificationUnmuteIcon />
          ) : (
            <MutedNotificationsIcon className="h-4 w-4 shrink-0 text-white/55" />
          )
        }
        label={muteActionLabel}
        onClick={onNotificationMuteToggle}
      />
      <NotificationScopeMenuButton
        className={cx(actionClassName, variant === 'compact' && 'mt-1')}
        icon={<NotificationSettingsIcon />}
        label={copy.notifications.settings}
        onClick={onNotificationSettingsOpen}
        trailing={variant === 'compact' ? <MenuChevronIcon /> : undefined}
      />
    </>
  );
}

function NotificationScopeMenuButton({
  className,
  icon,
  label,
  onClick,
  trailing,
}: {
  className: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-3 text-left text-white/85 transition hover:bg-white/10 hover:text-white',
        className,
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

function NotificationUnmuteIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 shrink-0 text-white/55"
    >
      <path
        d="M4.75 9.5h3.1l4.4-3.7v12.4l-4.4-3.7h-3.1v-5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M16.6 8.5a4.9 4.9 0 0 1 0 7M18.9 6.2a8.3 8.3 0 0 1 0 11.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function NotificationSettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 shrink-0 text-white/55"
    >
      <path
        d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.35 13.15v-2.3l-2.05-.42a5.8 5.8 0 0 0-.58-1.4l1.15-1.75-1.62-1.62-1.75 1.15a5.8 5.8 0 0 0-1.4-.58L12.7 4h-2.3l-.4 2.05a5.8 5.8 0 0 0-1.42.58L6.85 5.48 5.23 7.1l1.15 1.75a5.8 5.8 0 0 0-.58 1.4l-2.05.42v2.3l2.05.42c.12.5.32.98.58 1.4l-1.15 1.75 1.62 1.62 1.75-1.15c.44.26.92.46 1.42.58l.4 2.05h2.3l.4-2.05c.5-.12.98-.32 1.4-.58l1.75 1.15 1.62-1.62-1.15-1.75c.26-.44.46-.92.58-1.4l2.03-.24Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MenuChevronIcon() {
  return (
    <span aria-hidden="true" className="text-lg text-white/35">
      ›
    </span>
  );
}
