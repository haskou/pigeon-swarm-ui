import type {
  NotificationResource,
  Session,
} from '../../shared/domain/pigeonResources.types';

import { PigeonApiGateway } from './PigeonApiGateway';
import { PigeonNotificationsApplication } from './PigeonNotificationsApplication';

describe(PigeonNotificationsApplication.name, () => {
  function gatewayDouble(): jest.Mocked<PigeonApiGateway> {
    return {
      listNotifications: jest.fn(),
      registerPushSubscription: jest.fn(),
      updateNotification: jest.fn(),
    } as unknown as jest.Mocked<PigeonApiGateway>;
  }

  const session = {
    identity: { id: 'identity-1' },
  } as unknown as Session;

  it('lists notifications through the application use case', async () => {
    const gateway = gatewayDouble();
    const notifications = [{ id: 'notification-1' }] as NotificationResource[];
    gateway.listNotifications.mockResolvedValue(notifications);
    const application = new PigeonNotificationsApplication(gateway);

    await expect(application.list(session)).resolves.toBe(notifications);
    expect(gateway.listNotifications).toHaveBeenCalledWith(session);
  });

  it('converts browser push subscriptions at the application boundary', async () => {
    const gateway = gatewayDouble();
    const application = new PigeonNotificationsApplication(gateway);
    const subscription: PushSubscriptionJSON = {
      endpoint: 'https://push.example/subscription',
      expirationTime: null,
      keys: { auth: 'auth-key', p256dh: 'public-key' },
    };

    await application.registerPushSubscription(session, subscription);

    expect(gateway.registerPushSubscription).toHaveBeenCalledWith(session, {
      endpoint: subscription.endpoint,
      expirationTime: null,
      keys: subscription.keys,
    });
  });

  it('rejects incomplete browser push subscriptions before the gateway', async () => {
    const gateway = gatewayDouble();
    const application = new PigeonNotificationsApplication(gateway);

    await expect(
      application.registerPushSubscription(session, {
        endpoint: 'https://push.example/subscription',
      }),
    ).rejects.toThrow('Invalid push subscription.');

    expect(gateway.registerPushSubscription).not.toHaveBeenCalled();
  });

  it('updates notifications through the domain decision use case', async () => {
    const gateway = gatewayDouble();
    const updated = {
      id: 'notification-1',
      state: 'accepted',
    } as NotificationResource;
    gateway.updateNotification.mockResolvedValue(updated);
    const application = new PigeonNotificationsApplication(gateway);

    await expect(
      application.update(session, updated.id, 'accepted'),
    ).resolves.toBe(updated);
    expect(gateway.updateNotification).toHaveBeenCalledWith(
      session,
      expect.objectContaining({ toString: expect.any(Function) }),
      expect.objectContaining({ toString: expect.any(Function) }),
    );
  });
});
