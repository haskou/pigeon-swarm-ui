import type { ApplicationServerKey } from './ApplicationServerKey';
import type { DeliverablePushSubscriptionJson } from './DeliverablePushSubscriptionJson';
import type { EnsurePwaPushSubscriptionOptions } from './EnsurePwaPushSubscriptionOptions';
import type { EnsurePwaPushSubscriptionResult } from './EnsurePwaPushSubscriptionResult';
import type { OptionalApplicationServerKey } from './OptionalApplicationServerKey';
import type { Permission } from './Permission';
import type { PermissionRequester } from './PermissionRequester';
import type { PwaNotificationPayload } from './PwaNotificationPayload';
import type { PwaNotificationPermission } from './PwaNotificationPermission';

export type { EnsurePwaPushSubscriptionResult } from './EnsurePwaPushSubscriptionResult';
export type { PwaNotificationPermission } from './PwaNotificationPermission';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';

const notificationBadge = '/favicon/notification-badge.png';
const explicitSubscriptionPromises = new Map<
  string,
  Promise<EnsurePwaPushSubscriptionResult>
>();

class PushSubscriptionsUnsupportedError extends Error {}

export function canUsePwaNotifications(): boolean {
  return (
    'Notification' in globalThis &&
    'navigator' in globalThis &&
    'serviceWorker' in navigator
  );
}

export function canUsePwaPushSubscriptions(): boolean {
  return canUsePwaNotifications();
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
    badge: notificationBadge,
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
  if (!registration.pushManager) {
    throw new PushSubscriptionsUnsupportedError();
  }

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

async function ensurePwaPushSubscriptionOnce(
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
  let subscription: PushSubscription;

  try {
    subscription = await subscriptionForRegistration(
      session,
      registration,
      applicationServerKey,
    );
  } catch (caught) {
    if (caught instanceof PushSubscriptionsUnsupportedError) {
      return 'unsupported';
    }

    throw caught;
  }

  await applicationContainer.registerPushSubscription(
    session,
    subscription.toJSON(),
  );

  return 'granted';
}

export async function ensurePwaPushSubscription(
  session: Session,
  options: EnsurePwaPushSubscriptionOptions = {},
): Promise<EnsurePwaPushSubscriptionResult> {
  if (!options.requestPermission) {
    return await ensurePwaPushSubscriptionOnce(session, options);
  }

  const pendingSubscription = explicitSubscriptionPromises.get(
    session.identity.id,
  );

  if (pendingSubscription) return await pendingSubscription;

  const subscription = ensurePwaPushSubscriptionOnce(session, options).finally(
    () => {
      explicitSubscriptionPromises.delete(session.identity.id);
    },
  );

  explicitSubscriptionPromises.set(session.identity.id, subscription);

  return await subscription;
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
