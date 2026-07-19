import { mock } from 'jest-mock-extended';

import type { PushSubscriptionRepository } from '../../../../../contexts/notifications/domain/repositories/PushSubscriptionRepository';

import { RegisterPushSubscriptionMessage } from '../../../../../contexts/notifications/application/register-push-subscription/messages/RegisterPushSubscriptionMessage';
import { PushSubscriptionRegistrar } from '../../../../../contexts/notifications/application/register-push-subscription/PushSubscriptionRegistrar';

describe(PushSubscriptionRegistrar.name, () => {
  it('registers a validated subscription through its repository', async () => {
    const repository = mock<PushSubscriptionRepository>();
    const registrar = new PushSubscriptionRegistrar(repository);

    await registrar.register(
      new RegisterPushSubscriptionMessage({
        auth: 'auth',
        endpoint: 'https://push.example/1',
        expirationTime: null,
        occurredAt: 42,
        p256dh: 'p256dh',
        recipientIdentityId: 'identity-1',
      }),
    );

    const subscription = repository.save.mock.calls[0]?.[0];

    expect(subscription?.toPrimitives()).toEqual(
      expect.objectContaining({ endpoint: 'https://push.example/1' }),
    );
    expect(subscription?.pullDomainEvents()).toEqual([
      expect.objectContaining({ type: 'PushSubscriptionRegistered' }),
    ]);
  });
});
