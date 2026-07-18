import type { PushSubscription } from '../PushSubscription';
import type { NotificationRecipientId } from '../value-objects/NotificationRecipientId';

export interface PushSubscriptionRepository {
  remove(
    subscription: PushSubscription,
    recipientIdentityId: NotificationRecipientId,
  ): Promise<void>;
  save(
    subscription: PushSubscription,
    recipientIdentityId: NotificationRecipientId,
  ): Promise<void>;
}
