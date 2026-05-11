import type { NotificationResource, Session } from '../../domain/types';
import type { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

import { UpdateNotification } from './UpdateNotification';

describe(UpdateNotification.name, () => {
  it('delegates notification state updates to the pigeon API gateway', async () => {
    const session = { password: 'secret' } as Session;
    const expected = {
      id: 'notification-1',
      state: 'declined',
    } as NotificationResource;
    const gateway = {
      updateNotification: jest.fn().mockResolvedValue(expected),
    } as unknown as PigeonApiGateway;
    const useCase = new UpdateNotification(gateway);

    await expect(
      useCase.execute(session, 'notification-1', 'declined'),
    ).resolves.toBe(expected);
    expect(gateway.updateNotification).toHaveBeenCalledWith(
      session,
      'notification-1',
      'declined',
    );
  });
});
