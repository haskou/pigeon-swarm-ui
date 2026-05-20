import type { Session } from '../../../../domain/types';

import { pigeonApplication } from '../../../../application/applicationContainer';

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

function canUsePushSubscriptions(): boolean {
  return canUsePwaNotifications() && 'PushManager' in globalThis;
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

export async function ensurePwaPushSubscription(
  session: Session,
): Promise<void> {
  if (!canUsePushSubscriptions()) return;

  const vapid = await pigeonApplication.getPushVapidPublicKey();

  if (!vapid.enabled || !vapid.publicKey) return;

  const permission = await requestPwaNotificationPermission();

  if (permission !== 'granted') return;

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ??
    (await registration.pushManager.subscribe({
      applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      userVisibleOnly: true,
    }));

  await pigeonApplication.registerPushSubscription(
    session,
    subscription.toJSON(),
  );
}

export async function deletePwaPushSubscription(
  session: Session,
): Promise<void> {
  if (!canUsePushSubscriptions()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) return;

  await pigeonApplication.deletePushSubscription(
    session,
    subscription.toJSON(),
  );
  await subscription.unsubscribe();
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}
