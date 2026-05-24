import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';

type PwaNotificationPayload = {
  body: string;
  tag: string;
  title: string;
  url?: string;
};
type EnsurePwaPushSubscriptionOptions = {
  requestPermission?: boolean;
};
type Permission = NotificationPermission;
type PermissionRequester = () => Promise<Permission>;

export function canUsePwaNotifications(): boolean {
  return (
    'Notification' in globalThis &&
    'navigator' in globalThis &&
    'serviceWorker' in navigator
  );
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

export async function ensurePwaPushSubscription(
  session: Session,
  options: EnsurePwaPushSubscriptionOptions = {},
): Promise<void> {
  if (!canUsePushSubscriptions()) return;

  const permission = options.requestPermission
    ? await requestPwaNotificationPermission()
    : Notification.permission;

  if (permission !== 'granted') return;

  const vapid = await applicationContainer.getPushVapidPublicKey();

  if (!vapid.enabled || !vapid.publicKey) return;

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ??
    (await registration.pushManager.subscribe({
      applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      userVisibleOnly: true,
    }));

  await applicationContainer.registerPushSubscription(
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

  await applicationContainer.deletePushSubscription(
    session,
    subscription.toJSON(),
  );
  await subscription.unsubscribe();
}
