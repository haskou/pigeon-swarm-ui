import type { Notification } from '../Notification';
import type { NotificationId } from '../value-objects/NotificationId';
import type { NotificationRecipientId } from '../value-objects/NotificationRecipientId';

export interface NotificationRepository {
  find(
    id: NotificationId,
    recipientIdentityId: NotificationRecipientId,
  ): Promise<Notification>;
  save(
    notification: Notification,
    recipientIdentityId: NotificationRecipientId,
  ): Promise<Notification>;
  searchByRecipient(
    recipientIdentityId: NotificationRecipientId,
  ): Promise<Notification[]>;
}
