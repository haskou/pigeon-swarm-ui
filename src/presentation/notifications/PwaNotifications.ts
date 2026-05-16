type PwaNotificationPayload = {
  body: string;
  tag: string;
  title: string;
  url?: string;
};
type Permission = NotificationPermission;
type PermissionRequester = () => Promise<Permission>;

export function canUsePwaNotifications(): boolean {
  return 'Notification' in globalThis && 'serviceWorker' in navigator;
}

export const requestPwaNotificationPermission: PermissionRequester =
  async () => {
    if (!canUsePwaNotifications()) return 'denied';

    if (Notification.permission !== 'default') return Notification.permission;

    return await Notification.requestPermission();
  };

export async function showPwaNotification(
  payload: PwaNotificationPayload,
): Promise<void> {
  if (!canUsePwaNotifications()) return;

  if (Notification.permission === 'default') {
    const permission = await requestPwaNotificationPermission();

    if (permission !== 'granted') return;
  }

  if (Notification.permission !== 'granted') return;

  if (document.visibilityState === 'visible') return;

  const registration = await navigator.serviceWorker.ready;

  await registration.showNotification(payload.title, {
    badge: '/favicon/favicon-32x32.png',
    body: payload.body,
    data: {
      url: payload.url ?? '/',
    },
    icon: '/favicon/android-chrome-192x192.png',
    tag: payload.tag,
  });
}
