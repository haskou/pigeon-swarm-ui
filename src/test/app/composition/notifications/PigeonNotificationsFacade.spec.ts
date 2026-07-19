import { mock } from 'jest-mock-extended';

import type { NotificationUseCases } from '../../../../app/composition/notifications/NotificationUseCases';
import type { PushNotificationServerFinder } from '../../../../contexts/notifications/application/find-push-notification-server/PushNotificationServerFinder';
import type { PushSubscriptionRegistrar } from '../../../../contexts/notifications/application/register-push-subscription/PushSubscriptionRegistrar';
import type { PushSubscriptionRemover } from '../../../../contexts/notifications/application/remove-push-subscription/PushSubscriptionRemover';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { PigeonNotificationsFacade } from '../../../../app/composition/notifications/PigeonNotificationsFacade';
import { PushNotificationServer } from '../../../../contexts/notifications/domain/PushNotificationServer';
import { NotificationAccessContexts } from '../../../../contexts/notifications/infrastructure/http/NotificationAccessContexts';
import { NotificationMapper } from '../../../../contexts/notifications/infrastructure/http/NotificationMapper';
import { NotificationSettingMapper } from '../../../../contexts/notifications/infrastructure/http/NotificationSettingMapper';

describe(PigeonNotificationsFacade.name, () => {
  it('routes browser subscriptions through application use cases', async () => {
    const useCases = mock<NotificationUseCases>();
    const registrar = mock<PushSubscriptionRegistrar>();
    const remover = mock<PushSubscriptionRemover>();
    useCases.pushSubscriptionRegistrar = registrar;
    useCases.pushSubscriptionRemover = remover;
    const facade = new PigeonNotificationsFacade(
      new NotificationAccessContexts(),
      new NotificationMapper(),
      new NotificationSettingMapper(),
      useCases,
    );
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const subscription = {
      endpoint: 'https://push.example/1',
      expirationTime: null,
      keys: { auth: 'auth', p256dh: 'p256dh' },
    };

    await facade.registerPushSubscription(session, subscription);
    await facade.deletePushSubscription(session, subscription);

    const registrationMessage = registrar.register.mock.calls[0]?.[0];
    const removalMessage = remover.remove.mock.calls[0]?.[0];
    expect(registrationMessage?.getEndpoint().toString()).toBe(
      'https://push.example/1',
    );
    expect(registrationMessage?.getRecipientIdentityId().toString()).toBe(
      'identity-1',
    );
    expect(removalMessage?.getSubscription().toPrimitives()).toEqual(
      expect.objectContaining({ endpoint: 'https://push.example/1' }),
    );
  });

  it('projects the push server configuration returned by its finder', async () => {
    const useCases = mock<NotificationUseCases>();
    const finder = mock<PushNotificationServerFinder>();
    useCases.pushServerFinder = finder;
    finder.find.mockResolvedValue(
      PushNotificationServer.fromPrimitives({
        enabled: true,
        publicKey: 'public-key',
      }),
    );
    const facade = new PigeonNotificationsFacade(
      new NotificationAccessContexts(),
      new NotificationMapper(),
      new NotificationSettingMapper(),
      useCases,
    );

    await expect(facade.getPushVapidPublicKey()).resolves.toEqual({
      enabled: true,
      publicKey: 'public-key',
    });
  });
});
