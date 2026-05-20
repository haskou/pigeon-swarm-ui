import type { NotificationResource } from '../../../../domain/types';
import type { ListNotificationsPort } from '../ports/listNotificationsPort';

import { ListNotificationsMessage } from './messages/listNotificationsMessage';

export class ListNotifications {
  public constructor(private readonly notifications: ListNotificationsPort) {}

  public async list(
    message: ListNotificationsMessage,
  ): Promise<NotificationResource[]> {
    return await this.notifications.listNotifications(message.getSession());
  }
}
