import type { UpdateNotificationPort } from '../../../../../contexts/notifications/application/ports/UpdateNotificationPort';
import type {
  NotificationResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { UpdateNotificationMessage } from '../../../../../contexts/notifications/application/update-notification/messages/UpdateNotificationMessage';
import { UpdateNotification } from '../../../../../contexts/notifications/application/update-notification/UpdateNotification';
import { NotificationDecision } from '../../../../../contexts/notifications/domain/NotificationDecision';
import { NotificationId } from '../../../../../contexts/notifications/domain/NotificationId';

describe(UpdateNotification.name, () => {
  it('delegates notification state updates to the pigeon API gateway', async () => {
    const session = {} as Session;
    const expected = {
      id: 'notification-1',
      state: 'declined',
    } as NotificationResource;
    const updateNotification: jest.MockedFunction<
      UpdateNotificationPort['updateNotification']
    > = jest.fn().mockResolvedValue(expected);
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
