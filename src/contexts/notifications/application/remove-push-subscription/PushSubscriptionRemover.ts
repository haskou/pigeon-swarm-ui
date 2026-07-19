import type { PushSubscriptionRepository } from '../../domain/repositories/PushSubscriptionRepository';

import { RemovePushSubscriptionMessage } from './messages/RemovePushSubscriptionMessage';

export class PushSubscriptionRemover {
  public constructor(private readonly repository: PushSubscriptionRepository) {}

  public async remove(message: RemovePushSubscriptionMessage): Promise<void> {
    const subscription = message.getSubscription();

    subscription.remove(message.getOccurredAt());
    await this.repository.remove(
      subscription,
      message.getRecipientIdentityId(),
    );
  }
}
