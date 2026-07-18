import type { PwaNotificationPayload } from './PwaNotificationPayload';

import { PwaNotificationCapability } from './PwaNotificationCapability';

const notificationBadge = '/favicon/notification-badge.png';

export class PwaNotificationPresenter {
  public constructor(private readonly capability: PwaNotificationCapability) {}

  public async show(payload: PwaNotificationPayload): Promise<void> {
    if (!this.capability.canNotify()) return;

    if (Notification.permission !== 'granted') return;

    const pageIsVisible = document.visibilityState === 'visible';
    const pageIsFocused =
      typeof document.hasFocus !== 'function' || document.hasFocus();

    if (pageIsVisible && pageIsFocused) return;

    const registration = await navigator.serviceWorker.ready;

    await registration.showNotification(payload.title, {
      badge: notificationBadge,
      body: payload.body,
      data: { url: payload.url ?? '/' },
      icon: '/favicon/android-chrome-192x192.png',
      tag: payload.tag,
    });
  }
}
