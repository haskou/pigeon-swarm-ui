import { mock } from 'jest-mock-extended';

import type { PushNotificationServerRepository } from '../../../../../contexts/notifications/domain/repositories/PushNotificationServerRepository';

import { PushNotificationServerFinder } from '../../../../../contexts/notifications/application/find-push-notification-server/PushNotificationServerFinder';
import { PushNotificationServer } from '../../../../../contexts/notifications/domain/PushNotificationServer';

describe(PushNotificationServerFinder.name, () => {
  it('finds the current push server configuration', async () => {
    const repository = mock<PushNotificationServerRepository>();
    const server = PushNotificationServer.fromPrimitives({
      enabled: true,
      publicKey: 'public-key',
    });
    repository.find.mockResolvedValue(server);

    await expect(
      new PushNotificationServerFinder(repository).find(),
    ).resolves.toBe(server);
  });
});
