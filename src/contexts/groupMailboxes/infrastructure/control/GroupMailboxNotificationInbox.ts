import type { Session } from '../../../identities/infrastructure/session/Session';
import type { NotificationResource } from '../../../notifications/infrastructure/http/resources/NotificationResource';
import type { GroupMailboxLetterState } from './GroupMailboxLetterState';

/** This identity's notifications, and the state records that resolve them. */
export interface GroupMailboxNotificationInbox {
  /** One page of them, newest id first. */
  listPage(
    session: Session,
    limit: number,
    beforeNotificationId?: string,
  ): Promise<NotificationResource[]>;
  /**
   * Signs `state` for a pending notification; the node keeps the first
   * resolution only.
   */
  update(
    session: Session,
    notificationId: string,
    state: GroupMailboxLetterState,
  ): Promise<NotificationResource>;
}
