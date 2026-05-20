import type { NotificationResource, Session } from '../../../../domain/types';
import type { NotificationDecision } from '../../domain/notificationDecision';
import type { NotificationId } from '../../domain/notificationId';

export interface UpdateNotificationPort {
  updateNotification(
    session: Session,
    notificationId: NotificationId,
    decision: NotificationDecision,
  ): Promise<NotificationResource>;
}
