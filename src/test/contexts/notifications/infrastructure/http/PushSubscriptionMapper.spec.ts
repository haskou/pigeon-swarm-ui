import { PushSubscription } from '../../../../../contexts/notifications/domain/PushSubscription';
import { PushSubscriptionMapper } from '../../../../../contexts/notifications/infrastructure/http/PushSubscriptionMapper';

describe(PushSubscriptionMapper.name, () => {
  it('maps a domain subscription to the HTTP payload', () => {
    const mapper = new PushSubscriptionMapper();

    expect(
      mapper.toPayload(
        PushSubscription.fromPrimitives({
          auth: 'auth',
          endpoint: 'https://push.example/1',
          expirationTime: null,
          p256dh: 'p256dh',
        }),
      ),
    ).toEqual({
      endpoint: 'https://push.example/1',
      expirationTime: null,
      keys: { auth: 'auth', p256dh: 'p256dh' },
    });
  });
});
