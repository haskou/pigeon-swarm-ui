import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { EnsurePwaPushSubscriptionOptions } from '../../infrastructure/browser/EnsurePwaPushSubscriptionOptions';
import type { EnsurePwaPushSubscriptionResult } from '../../infrastructure/browser/EnsurePwaPushSubscriptionResult';
import type { PermissionRequester } from '../../infrastructure/browser/PermissionRequester';
import type { PwaNotificationPayload } from '../../infrastructure/browser/PwaNotificationPayload';
import type { PwaNotificationPermission } from '../../infrastructure/browser/PwaNotificationPermission';
import type { PwaPushSubscriptionBackend } from './PwaPushSubscriptionBackend';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { ApplicationServerKeyDecoder } from '../../infrastructure/browser/ApplicationServerKeyDecoder';
import { PushSubscriptionCompatibility } from '../../infrastructure/browser/PushSubscriptionCompatibility';
import { PwaNotificationCapability } from '../../infrastructure/browser/PwaNotificationCapability';
import { PwaNotificationPresenter } from '../../infrastructure/browser/PwaNotificationPresenter';
import { PwaPushSubscriptionRegistrar } from './PwaPushSubscriptionRegistrar';

export type { EnsurePwaPushSubscriptionResult } from '../../infrastructure/browser/EnsurePwaPushSubscriptionResult';
export type { PwaNotificationPermission } from '../../infrastructure/browser/PwaNotificationPermission';

const capability = new PwaNotificationCapability();
const presenter = new PwaNotificationPresenter(capability);
const backend: PwaPushSubscriptionBackend = {
  delete: async (session, subscription) =>
    await applicationContainer.notifications.deletePushSubscription(
      session,
      subscription,
    ),
  findServer: async () =>
    await applicationContainer.notifications.getPushVapidPublicKey(),
  register: async (session, subscription) =>
    await applicationContainer.notifications.registerPushSubscription(
      session,
      subscription,
    ),
};
const manager = new PwaPushSubscriptionRegistrar(
  backend,
  capability,
  new ApplicationServerKeyDecoder(),
  new PushSubscriptionCompatibility(),
);

export function canUsePwaNotifications(): boolean {
  return capability.canNotify();
}

export function canUsePwaPushSubscriptions(): boolean {
  return capability.canNotify();
}

export function currentPwaNotificationPermission(): PwaNotificationPermission {
  return capability.currentPermission();
}

export const requestPwaNotificationPermission: PermissionRequester = async () =>
  await capability.requestPermission();

export async function showPwaNotification(
  payload: PwaNotificationPayload,
): Promise<void> {
  await presenter.show(payload);
}

export async function ensurePwaPushSubscription(
  session: Session,
  options: EnsurePwaPushSubscriptionOptions = {},
): Promise<EnsurePwaPushSubscriptionResult> {
  return await manager.ensure(session, options);
}

export async function deletePwaPushSubscription(
  session: Session,
): Promise<void> {
  await manager.delete(session);
}
