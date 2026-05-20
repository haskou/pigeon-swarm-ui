import type {
  NotificationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { UpdateNotificationPort } from '../ports/UpdateNotificationPort';

import { NotificationDecision } from '../../domain/notificationDecision';
import { NotificationId } from '../../domain/NotificationId';
import { UpdateNotificationMessage } from './messages/UpdateNotificationMessage';
import { UpdateNotification } from './UpdateNotification';

describe(UpdateNotification.name, () => {
  it('delegates notification state updates to the pigeon API gateway', async () => {
    const session = { password: 'secret' } as Session;
    const expected = {
      id: 'notification-1',
      state: 'declined',
    } as NotificationResource;
    const updateNotification = jest.fn().mockResolvedValue(expected);
    const gateway: UpdateNotificationPort = { updateNotification };
    const useCase = new UpdateNotification(gateway);

    await expect(
      useCase.update(
        new UpdateNotificationMessage({
          notificationId: 'notification-1',
          session,
          state: 'declined',
        }),
      ),
    ).resolves.toBe(expected);
    const [sentSession, notificationId, decision] =
      updateNotification.mock.calls[0] ?? [];

    expect(sentSession).toBe(session);
    expect(notificationId).toBeInstanceOf(NotificationId);
    expect(
      notificationId.isEqual(NotificationId.fromString('notification-1')),
    ).toBe(true);
    expect(decision).toBeInstanceOf(NotificationDecision);
    expect(decision.isDeclined()).toBe(true);
  });
});
