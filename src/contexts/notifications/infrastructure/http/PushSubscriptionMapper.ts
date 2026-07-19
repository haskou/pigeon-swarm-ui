import type { PushSubscription } from '../../domain/PushSubscription';
import type { PushSubscriptionPayload } from './PushSubscriptionPayload';

export class PushSubscriptionMapper {
  public toPayload(subscription: PushSubscription): PushSubscriptionPayload {
    const primitives = subscription.toPrimitives();

    return {
      endpoint: primitives.endpoint,
      expirationTime: primitives.expirationTime,
      keys: {
        auth: primitives.auth,
        p256dh: primitives.p256dh,
      },
    };
  }
}
