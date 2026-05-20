import type {
  NotificationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { NotificationDecision } from '../../domain/notificationDecision';
import type { NotificationId } from '../../domain/NotificationId';

export interface UpdateNotificationPort {
  updateNotification(
    session: Session,
    notificationId: NotificationId,
    decision: NotificationDecision,
  ): Promise<NotificationResource>;
}
