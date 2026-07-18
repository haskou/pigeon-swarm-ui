import type { PushSubscription } from '../../domain/PushSubscription';
import type { PushSubscriptionRepository } from '../../domain/repositories/PushSubscriptionRepository';
import type { NotificationRecipientId } from '../../domain/value-objects/NotificationRecipientId';

import { NotificationAccessContexts } from './NotificationAccessContexts';
import { PigeonPushApi } from './PigeonPushApi';
import { PushSubscriptionMapper } from './PushSubscriptionMapper';

// prettier-ignore
export class PigeonPushSubscriptionRepository
  implements PushSubscriptionRepository {
  public constructor(
    private readonly api: PigeonPushApi,
    private readonly contexts: NotificationAccessContexts,
    private readonly mapper: PushSubscriptionMapper,
  ) {}

  public async remove(
    subscription: PushSubscription,
    recipientIdentityId: NotificationRecipientId,
  ): Promise<void> {
    await this.api.deleteSubscription(
      this.contexts.find(recipientIdentityId),
      this.mapper.toPayload(subscription),
    );
  }

  public async save(
    subscription: PushSubscription,
    recipientIdentityId: NotificationRecipientId,
  ): Promise<void> {
    await this.api.registerSubscription(
      this.contexts.find(recipientIdentityId),
      this.mapper.toPayload(subscription),
    );
  }
}
