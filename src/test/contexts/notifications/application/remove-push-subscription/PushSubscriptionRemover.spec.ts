import { mock } from 'jest-mock-extended';

import type { PushSubscriptionRepository } from '../../../../../contexts/notifications/domain/repositories/PushSubscriptionRepository';

import { RemovePushSubscriptionMessage } from '../../../../../contexts/notifications/application/remove-push-subscription/messages/RemovePushSubscriptionMessage';
import { PushSubscriptionRemover } from '../../../../../contexts/notifications/application/remove-push-subscription/PushSubscriptionRemover';

describe(PushSubscriptionRemover.name, () => {
  it('removes a validated subscription through its repository', async () => {
    const repository = mock<PushSubscriptionRepository>();
    const remover = new PushSubscriptionRemover(repository);

    await remover.remove(
      new RemovePushSubscriptionMessage({
        auth: 'auth',
        endpoint: 'https://push.example/1',
        expirationTime: null,
        occurredAt: 42,
        p256dh: 'p256dh',
        recipientIdentityId: 'identity-1',
      }),
    );

    const subscription = repository.remove.mock.calls[0]?.[0];

    expect(subscription?.pullDomainEvents()).toEqual([
      expect.objectContaining({ type: 'PushSubscriptionRemoved' }),
    ]);
  });
});
