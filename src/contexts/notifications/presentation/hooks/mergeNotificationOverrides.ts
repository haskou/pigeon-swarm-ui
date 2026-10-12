import type { NotificationResource } from '../../infrastructure/http/resources/NotificationResource';

export function mergeNotificationOverrides(
  notifications: NotificationResource[],
  overrides: ReadonlyMap<string, NotificationResource>,
): NotificationResource[] {
  if (overrides.size === 0) return notifications;

  return notifications.map(
    (notification) => overrides.get(notification.id) ?? notification,
  );
}
