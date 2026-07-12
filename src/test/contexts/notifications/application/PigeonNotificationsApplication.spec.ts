import type {
  NotificationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { PigeonNotificationsApplication } from '../../../../contexts/notifications/application/PigeonNotificationsApplication';

describe(PigeonNotificationsApplication.name, () => {
  type Dependencies = ConstructorParameters<
    typeof PigeonNotificationsApplication
  >[0];

  function dependencies(): Dependencies {
    return {
      acceptInvitation: {
        keychainPublisher: { publishKeychain: jest.fn() },
        keyDecryptor: { decryptInvitationKey: jest.fn() },
        notifications: { updateNotification: jest.fn() },
      },
      listNotifications: { listNotifications: jest.fn() },
      listNotificationSettings: { listNotificationSettings: jest.fn() },
      push: {
        deletePushSubscription: jest.fn(),
        getPushVapidPublicKey: jest.fn(),
        registerPushSubscription: jest.fn(),
      },
      resetNotificationSetting: { resetNotificationSetting: jest.fn() },
      saveNotificationSetting: { saveNotificationSetting: jest.fn() },
      updateNotification: { updateNotification: jest.fn() },
    } as unknown as Dependencies;
  }

  const session = {
    identity: { id: 'identity-1' },
  } as unknown as Session;

  it('lists notifications through the application use case', async () => {
    const deps = dependencies();
    const notifications = [{ id: 'notification-1' }] as NotificationResource[];
    const listNotifications = deps.listNotifications
      .listNotifications as jest.Mock;
    listNotifications.mockResolvedValue(notifications);
    const application = new PigeonNotificationsApplication(deps);

    await expect(application.list(session)).resolves.toBe(notifications);
    expect(listNotifications).toHaveBeenCalledWith(session);
  });

  it('converts browser push subscriptions at the application boundary', async () => {
    const deps = dependencies();
    const application = new PigeonNotificationsApplication(deps);
    const subscription: PushSubscriptionJSON = {
      endpoint: 'https://push.example/subscription',
      expirationTime: null,
      keys: { auth: 'auth-key', p256dh: 'public-key' },
    };

    await application.registerPushSubscription(session, subscription);

    expect(deps.push.registerPushSubscription).toHaveBeenCalledWith(session, {
      endpoint: subscription.endpoint,
      expirationTime: null,
      keys: subscription.keys,
    });
  });

  it('rejects incomplete browser push subscriptions before the gateway', async () => {
    const deps = dependencies();
    const application = new PigeonNotificationsApplication(deps);

    await expect(
      application.registerPushSubscription(session, {
        endpoint: 'https://push.example/subscription',
      }),
    ).rejects.toThrow('Invalid push subscription.');

    expect(deps.push.registerPushSubscription).not.toHaveBeenCalled();
  });

  it('updates notifications through the domain decision use case', async () => {
    const deps = dependencies();
    const updated = {
      id: 'notification-1',
      state: 'accepted',
    } as NotificationResource;
    deps.updateNotification.updateNotification = jest
      .fn()
      .mockResolvedValue(updated);
    const application = new PigeonNotificationsApplication(deps);

    await expect(
      application.update(session, updated.id, 'accepted'),
    ).resolves.toBe(updated);
    expect(deps.updateNotification.updateNotification).toHaveBeenCalledWith(
      session,
      expect.objectContaining({ toString: expect.any(Function) }),
      expect.objectContaining({ toString: expect.any(Function) }),
    );
  });
});
