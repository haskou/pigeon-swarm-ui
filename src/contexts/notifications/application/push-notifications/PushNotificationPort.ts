import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { PushSubscriptionPayload } from '../../infrastructure/http/PigeonPushApi';

export interface PushNotificationPort {
  getPushVapidPublicKey(): Promise<{ enabled: boolean; publicKey?: string }>;
  registerPushSubscription(
    session: Session,
    subscription: PushSubscriptionPayload,
  ): Promise<void>;
  deletePushSubscription(
    session: Session,
    subscription: PushSubscriptionPayload,
  ): Promise<void>;
}
