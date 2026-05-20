import type { NotificationResource, Session } from '../../../../domain/types';

export interface ListNotificationsPort {
  listNotifications(session: Session): Promise<NotificationResource[]>;
}
