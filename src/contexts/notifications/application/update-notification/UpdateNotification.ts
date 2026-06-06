import type { NotificationResource } from '../../../../shared/domain/pigeonResources.types';
import type { UpdateNotificationPort } from '../ports/UpdateNotificationPort';

import { UpdateNotificationMessage } from './messages/UpdateNotificationMessage';

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
