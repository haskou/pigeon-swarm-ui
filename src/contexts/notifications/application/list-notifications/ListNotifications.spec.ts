import type {
  NotificationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { ListNotificationsPort } from '../ports/ListNotificationsPort';

import { ListNotifications } from './ListNotifications';
import { ListNotificationsMessage } from './messages/ListNotificationsMessage';

describe(ListNotifications.name, () => {
  it('delegates notification listing to the pigeon API gateway', async () => {
    const session = {} as Session;
    const expected = [{ id: 'notification-1' }] as NotificationResource[];
    const gateway = {
      listNotifications: jest.fn().mockResolvedValue(expected),
    } as unknown as ListNotificationsPort;
    const useCase = new ListNotifications(gateway);

    await expect(
      useCase.list(new ListNotificationsMessage(session)),
    ).resolves.toBe(expected);
    expect(gateway.listNotifications).toHaveBeenCalledWith(session);
  });
});
