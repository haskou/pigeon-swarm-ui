import type { NotificationScopeSetting } from '../../../../shared/domain/pigeonResources.types';

import { NotificationSettingsPolicy } from '../../domain/NotificationSettingsPolicy';
import { notificationSettingSummary } from '../view-models/notificationSettingSummary';
import { copy } from '../../../../shared/presentation/i18n/copy';

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

  if (variant === 'compact') {
    return (
      <>
        <button
          type="button"
          onClick={onNotificationMuteToggle}
          className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
        >
          <span>{muteActionLabel}</span>
          <NotificationMuteIcon muted={muted} />
        </button>
        <button
          type="button"
          onClick={onNotificationSettingsOpen}
          className="mt-1 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/10"
        >
          <span>
            <span className="block text-sm font-semibold text-white/85">
              {copy.notifications.settings}
            </span>
            <span className="mt-0.5 block text-xs font-medium text-white/45">
              {notificationSettingSummary(notificationSetting)}
            </span>
          </span>
          <span aria-hidden="true" className="text-lg text-white/35">
            ›
          </span>
        </button>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onNotificationMuteToggle}
        className="block w-full rounded-2xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
      >
        {muteActionLabel}
      </button>
      <button
        type="button"
        onClick={onNotificationSettingsOpen}
        className="block w-full rounded-2xl px-3 py-2 text-left transition hover:bg-white/10"
      >
        <span className="block font-black text-white/80">
          {copy.notifications.settings}
        </span>
        <span className="block text-xs font-bold text-white/40">
          {notificationSettingSummary(notificationSetting)}
        </span>
      </button>
    </>
  );
}

function NotificationMuteIcon({ muted }: { muted: boolean }) {
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
      {muted ? (
        <path
          d="m16.2 9.2 4 4m0-4-4 4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      ) : (
        <path
          d="M16.6 8.5a4.9 4.9 0 0 1 0 7M18.9 6.2a8.3 8.3 0 0 1 0 11.6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      )}
    </svg>
  );
}
