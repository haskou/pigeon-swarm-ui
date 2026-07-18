import type { Notification } from '../../domain/Notification';
import type { NotificationRepository } from '../../domain/repositories/NotificationRepository';

import { SearchNotificationsMessage } from './messages/SearchNotificationsMessage';

export class NotificationsSearcher {
  public constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  public async search(
    message: SearchNotificationsMessage,
  ): Promise<Notification[]> {
    return await this.notificationRepository.searchByRecipient(
      message.getRecipientIdentityId(),
    );
  }
}
