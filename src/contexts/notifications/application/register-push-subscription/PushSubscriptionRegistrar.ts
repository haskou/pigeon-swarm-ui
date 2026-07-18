import type { PushSubscriptionRepository } from '../../domain/repositories/PushSubscriptionRepository';

import { PushSubscription } from '../../domain/PushSubscription';
import { RegisterPushSubscriptionMessage } from './messages/RegisterPushSubscriptionMessage';

export class PushSubscriptionRegistrar {
  public constructor(private readonly repository: PushSubscriptionRepository) {}

  public async register(
    message: RegisterPushSubscriptionMessage,
  ): Promise<void> {
    const subscription = PushSubscription.register(
      message.getEndpoint(),
      message.getExpiration(),
      message.getAuth(),
      message.getP256dh(),
      message.getOccurredAt(),
    );

    await this.repository.save(subscription, message.getRecipientIdentityId());
  }
}
