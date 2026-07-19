import { Timestamp } from '@haskou/value-objects';

import { PushSubscription } from '../../../../contexts/notifications/domain/PushSubscription';
import { PushSubscriptionCredential } from '../../../../contexts/notifications/domain/value-objects/PushSubscriptionCredential';
import { PushSubscriptionEndpoint } from '../../../../contexts/notifications/domain/value-objects/PushSubscriptionEndpoint';
import { PushSubscriptionExpiration } from '../../../../contexts/notifications/domain/value-objects/PushSubscriptionExpiration';

describe(PushSubscription.name, () => {
  it('records registration through the aggregate root', () => {
    const subscription = PushSubscription.register(
      PushSubscriptionEndpoint.fromString('https://push.example/1'),
      PushSubscriptionExpiration.fromPrimitives(null),
      PushSubscriptionCredential.fromString('auth'),
      PushSubscriptionCredential.fromString('p256dh'),
      new Timestamp(42),
    );

    expect(subscription.toPrimitives()).toEqual({
      auth: 'auth',
      endpoint: 'https://push.example/1',
      expirationTime: null,
      p256dh: 'p256dh',
    });
    expect(subscription.pullDomainEvents()).toEqual([
      {
        aggregateId: 'https://push.example/1',
        occurredAt: 42,
        type: 'PushSubscriptionRegistered',
      },
    ]);
  });

  it('records removal on a hydrated subscription', () => {
    const subscription = PushSubscription.fromPrimitives({
      auth: 'auth',
      endpoint: 'https://push.example/1',
      expirationTime: undefined,
      p256dh: 'p256dh',
    });

    subscription.remove(new Timestamp(84));

    expect(subscription.pullDomainEvents()).toEqual([
      expect.objectContaining({
        occurredAt: 84,
        type: 'PushSubscriptionRemoved',
      }),
    ]);
  });
});
