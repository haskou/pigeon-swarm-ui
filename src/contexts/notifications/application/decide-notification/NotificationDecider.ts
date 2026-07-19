import type { Notification } from '../../domain/Notification';
import type { NotificationRepository } from '../../domain/repositories/NotificationRepository';

import { DecideNotificationMessage } from './messages/DecideNotificationMessage';

export class NotificationDecider {
  public constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  public async decide(
    message: DecideNotificationMessage,
  ): Promise<Notification> {
    const recipientIdentityId = message.getRecipientIdentityId();
    const notification = await this.notificationRepository.find(
      message.getNotificationId(),
      recipientIdentityId,
    );

    notification.decide(message.getDecision(), message.getOccurredAt());

    return await this.notificationRepository.save(
      notification,
      recipientIdentityId,
    );
  }
}
