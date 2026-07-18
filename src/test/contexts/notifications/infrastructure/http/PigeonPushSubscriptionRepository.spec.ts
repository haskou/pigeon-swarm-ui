import { mock } from 'jest-mock-extended';

import type { PigeonPushApi } from '../../../../../contexts/notifications/infrastructure/http/PigeonPushApi';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PushSubscription } from '../../../../../contexts/notifications/domain/PushSubscription';
import { NotificationRecipientId } from '../../../../../contexts/notifications/domain/value-objects/NotificationRecipientId';
import { NotificationAccessContexts } from '../../../../../contexts/notifications/infrastructure/http/NotificationAccessContexts';
import { PigeonPushSubscriptionRepository } from '../../../../../contexts/notifications/infrastructure/http/PigeonPushSubscriptionRepository';
import { PushSubscriptionMapper } from '../../../../../contexts/notifications/infrastructure/http/PushSubscriptionMapper';

describe(PigeonPushSubscriptionRepository.name, () => {
  it('saves and removes subscriptions with the recipient session', async () => {
    const api = mock<PigeonPushApi>();
    const contexts = new NotificationAccessContexts();
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const subscription = PushSubscription.fromPrimitives({
      auth: 'auth',
      endpoint: 'https://push.example/1',
      expirationTime: null,
      p256dh: 'p256dh',
    });
    const recipientIdentityId =
      NotificationRecipientId.fromString('identity-1');
    contexts.register(session);
    const repository = new PigeonPushSubscriptionRepository(
      api,
      contexts,
      new PushSubscriptionMapper(),
    );

    await repository.save(subscription, recipientIdentityId);
    await repository.remove(subscription, recipientIdentityId);

    const payload = {
      endpoint: 'https://push.example/1',
      expirationTime: null,
      keys: { auth: 'auth', p256dh: 'p256dh' },
    };
    expect(api.registerSubscription).toHaveBeenCalledWith(session, payload);
    expect(api.deleteSubscription).toHaveBeenCalledWith(session, payload);
  });
});
