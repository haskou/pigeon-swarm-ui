import { mock } from 'jest-mock-extended';

import type { NotificationRepository } from '../../../../../contexts/notifications/domain/repositories/NotificationRepository';

import { DecideNotificationMessage } from '../../../../../contexts/notifications/application/decide-notification/messages/DecideNotificationMessage';
import { NotificationDecider } from '../../../../../contexts/notifications/application/decide-notification/NotificationDecider';
import { Notification } from '../../../../../contexts/notifications/domain/Notification';

describe(NotificationDecider.name, () => {
  it('loads, decides and persists the notification aggregate', async () => {
    const repository = mock<NotificationRepository>();
    const notification = Notification.fromPrimitives({
      id: 'notification-1',
      recipientIdentityId: 'identity-1',
      state: 'pending',
      type: 'conversation_invitation',
    });
    repository.find.mockResolvedValue(notification);
    repository.save.mockResolvedValue(notification);
    const decider = new NotificationDecider(repository);

    await expect(
      decider.decide(
        new DecideNotificationMessage(
          'notification-1',
          'identity-1',
          'declined',
          42,
        ),
      ),
    ).resolves.toBe(notification);
    expect(notification.toPrimitives().state).toBe('declined');
    expect(repository.save).toHaveBeenCalledWith(
      notification,
      expect.objectContaining({ isEqual: expect.any(Function) }),
    );
  });
});
