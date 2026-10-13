import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectMessageOutboxRow } from './DirectMessageOutboxRow';

/**
 * Writes one copy of a queued send. Throws MailboxUnavailableError while the
 * peer inbox is absent.
 */
export type DirectMessageOutboxDelivery = {
  toPeer(session: Session, row: DirectMessageOutboxRow): Promise<void>;
  toOwn(session: Session, row: DirectMessageOutboxRow): Promise<void>;
};
