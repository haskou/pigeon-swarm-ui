import type { NotificationResource, Session } from '../../domain/types';
import type { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

import { ListNotifications } from './ListNotifications';

describe(ListNotifications.name, () => {
  it('delegates notification listing to the pigeon API gateway', async () => {
    const session = { password: 'secret' } as Session;
    const expected = [{ id: 'notification-1' }] as NotificationResource[];
    const gateway = {
      listNotifications: jest.fn().mockResolvedValue(expected),
    } as unknown as PigeonApiGateway;
    const useCase = new ListNotifications(gateway);

    await expect(useCase.execute(session)).resolves.toBe(expected);
    expect(gateway.listNotifications).toHaveBeenCalledWith(session);
  });
});
