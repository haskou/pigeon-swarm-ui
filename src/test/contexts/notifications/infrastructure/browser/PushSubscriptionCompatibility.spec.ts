import { PushSubscriptionCompatibility } from '../../../../../contexts/notifications/infrastructure/browser/PushSubscriptionCompatibility';

describe(PushSubscriptionCompatibility.name, () => {
  it('requires delivery credentials and the expected server key', () => {
    const compatibility = new PushSubscriptionCompatibility();
    const subscription = {
      options: { applicationServerKey: new Uint8Array([1, 2, 3]) },
      toJSON: () => ({
        endpoint: 'https://push.example/1',
        keys: { auth: 'auth', p256dh: 'p256dh' },
      }),
    } as unknown as PushSubscription;

    expect(
      compatibility.canReuse(subscription, new Uint8Array([1, 2, 3])),
    ).toBe(true);
    expect(
      compatibility.canReuse(subscription, new Uint8Array([3, 2, 1])),
    ).toBe(false);
    expect(compatibility.isDeliverable({ endpoint: 'missing-keys' })).toBe(
      false,
    );
  });
});
