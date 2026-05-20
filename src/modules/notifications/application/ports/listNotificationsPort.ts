import type {
  NotificationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface ListNotificationsPort {
  listNotifications(session: Session): Promise<NotificationResource[]>;
}
