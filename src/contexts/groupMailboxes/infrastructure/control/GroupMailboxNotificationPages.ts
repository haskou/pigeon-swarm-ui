import type { Session } from '../../../identities/infrastructure/session/Session';
import type { NotificationResource } from '../../../notifications/infrastructure/http/resources/NotificationResource';

/** One page of this identity's notifications, newest id first. */
export interface GroupMailboxNotificationPages {
  listPage(
    session: Session,
    limit: number,
    beforeNotificationId?: string,
  ): Promise<NotificationResource[]>;
}
