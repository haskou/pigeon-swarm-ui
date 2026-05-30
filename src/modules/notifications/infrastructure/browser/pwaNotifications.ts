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
export type EnsurePwaPushSubscriptionResult =
  | 'granted'
  | 'permission_denied'
  | 'server_disabled'
  | 'unsupported';
type Permission = NotificationPermission;
type PermissionRequester = () => Promise<Permission>;
type ApplicationServerKey = Uint8Array<ArrayBuffer>;
type OptionalApplicationServerKey = ApplicationServerKey | null;
export type PwaNotificationPermission = NotificationPermission | 'unsupported';
type DeliverablePushSubscriptionJson = PushSubscriptionJSON & {
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
};

export function canUsePwaNotifications(): boolean {
  return (
    'Notification' in globalThis &&
    'navigator' in globalThis &&
    'serviceWorker' in navigator
  );
}

export function canUsePwaPushSubscriptions(): boolean {
  return canUsePwaNotifications() && 'PushManager' in globalThis;
}

export function currentPwaNotificationPermission(): PwaNotificationPermission {
  if (!canUsePwaPushSubscriptions()) return 'unsupported';

  return Notification.permission;
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

  const pageIsVisible = document.visibilityState === 'visible';
  const pageIsFocused =
    typeof document.hasFocus !== 'function' || document.hasFocus();

  if (pageIsVisible && pageIsFocused) return;

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

function urlBase64ToUint8Array(value: string): ApplicationServerKey {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}

function bufferSourceBytes(source: BufferSource): Uint8Array {
  if (source instanceof ArrayBuffer) {
    return new Uint8Array(source);
  }

  return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

function bufferSourcesAreEqual(
  left: BufferSource | null | undefined,
  right: Uint8Array,
): boolean {
  if (!left) return false;

  const leftBytes = bufferSourceBytes(left);

  if (leftBytes.byteLength !== right.byteLength) return false;

  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    if (leftBytes[index] !== right[index]) return false;
  }

  return true;
}

function hasDeliverableSubscriptionJson(
  subscription: PushSubscriptionJSON,
): subscription is DeliverablePushSubscriptionJson {
  return (
    typeof subscription.endpoint === 'string' &&
    subscription.endpoint.length > 0 &&
    typeof subscription.keys?.auth === 'string' &&
    subscription.keys.auth.length > 0 &&
    typeof subscription.keys.p256dh === 'string' &&
    subscription.keys.p256dh.length > 0
  );
}

function canReuseSubscription(
  subscription: PushSubscription,
  applicationServerKey: Uint8Array,
): boolean {
  return (
    hasDeliverableSubscriptionJson(subscription.toJSON()) &&
    bufferSourcesAreEqual(
      subscription.options?.applicationServerKey,
      applicationServerKey,
    )
  );
}

async function replaceBrowserSubscription(
  session: Session,
  subscription: PushSubscription,
): Promise<void> {
  const subscriptionJson = subscription.toJSON();

  if (hasDeliverableSubscriptionJson(subscriptionJson)) {
    try {
      await applicationContainer.deletePushSubscription(
        session,
        subscriptionJson,
      );
    } catch {
      // The local browser subscription still needs to be replaced.
    }
  }

  await subscription.unsubscribe();
}

async function currentPushPermission(
  options: EnsurePwaPushSubscriptionOptions,
): Promise<Permission> {
  return options.requestPermission
    ? await requestPwaNotificationPermission()
    : Notification.permission;
}

async function enabledServerKey(): Promise<OptionalApplicationServerKey> {
  const vapid = await applicationContainer.getPushVapidPublicKey();

  if (!vapid.enabled || !vapid.publicKey) return null;

  return urlBase64ToUint8Array(vapid.publicKey);
}

async function subscriptionForRegistration(
  session: Session,
  registration: ServiceWorkerRegistration,
  applicationServerKey: ApplicationServerKey,
): Promise<PushSubscription> {
  const existingSubscription = await registration.pushManager.getSubscription();

  if (!existingSubscription) {
    return await registration.pushManager.subscribe({
      applicationServerKey,
      userVisibleOnly: true,
    });
  }

  if (canReuseSubscription(existingSubscription, applicationServerKey)) {
    return existingSubscription;
  }

  await replaceBrowserSubscription(session, existingSubscription);

  return await registration.pushManager.subscribe({
    applicationServerKey,
    userVisibleOnly: true,
  });
}

export async function ensurePwaPushSubscription(
  session: Session,
  options: EnsurePwaPushSubscriptionOptions = {},
): Promise<EnsurePwaPushSubscriptionResult> {
  if (!canUsePwaPushSubscriptions()) return 'unsupported';

  if ((await currentPushPermission(options)) !== 'granted') {
    return 'permission_denied';
  }

  const applicationServerKey = await enabledServerKey();

  if (!applicationServerKey) return 'server_disabled';

  const registration = await navigator.serviceWorker.ready;
  const subscription = await subscriptionForRegistration(
    session,
    registration,
    applicationServerKey,
  );

  await applicationContainer.registerPushSubscription(
    session,
    subscription.toJSON(),
  );

  return 'granted';
}

export async function deletePwaPushSubscription(
  session: Session,
): Promise<void> {
  if (!canUsePwaPushSubscriptions()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) return;

  await applicationContainer.deletePushSubscription(
    session,
    subscription.toJSON(),
  );
  await subscription.unsubscribe();
}
