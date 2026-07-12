import type { NotificationResource } from '../../../../shared/domain/pigeonResources.types';
import type { ListNotificationsPort } from './ListNotificationsPort';

import { ListNotificationsMessage } from './messages/ListNotificationsMessage';

export class ListNotifications {
  public constructor(private readonly notifications: ListNotificationsPort) {}

  public async list(
    message: ListNotificationsMessage,
  ): Promise<NotificationResource[]> {
    return await this.notifications.listNotifications(message.getSession());
  }
}
