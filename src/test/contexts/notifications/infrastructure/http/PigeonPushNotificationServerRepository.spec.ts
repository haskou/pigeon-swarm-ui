import { mock } from 'jest-mock-extended';

import type { PigeonPushApi } from '../../../../../contexts/notifications/infrastructure/http/PigeonPushApi';

import { PigeonPushNotificationServerRepository } from '../../../../../contexts/notifications/infrastructure/http/PigeonPushNotificationServerRepository';

describe(PigeonPushNotificationServerRepository.name, () => {
  it('maps the HTTP server configuration to its domain model', async () => {
    const api = mock<PigeonPushApi>();
    api.getVapidPublicKey.mockResolvedValue({
      enabled: true,
      publicKey: 'public-key',
    });
    const repository = new PigeonPushNotificationServerRepository(api);
    const server = await repository.find();

    expect(server.toPrimitives()).toEqual({
      enabled: true,
      publicKey: 'public-key',
    });
  });
});
