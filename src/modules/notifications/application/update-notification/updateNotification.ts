import type { NotificationResource } from '../../../../shared/domain/pigeonResources.types';
import type { UpdateNotificationPort } from '../ports/updateNotificationPort';

import { UpdateNotificationMessage } from './messages/updateNotificationMessage';

export class UpdateNotification {
  public constructor(private readonly notifications: UpdateNotificationPort) {}

  public async update(
    message: UpdateNotificationMessage,
  ): Promise<NotificationResource> {
    return await this.notifications.updateNotification(
      message.getSession(),
      message.getNotificationId(),
      message.getDecision(),
    );
  }
}
