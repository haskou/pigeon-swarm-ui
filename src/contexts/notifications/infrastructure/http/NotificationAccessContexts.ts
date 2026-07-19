import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { NotificationRecipientId } from '../../domain/value-objects/NotificationRecipientId';

import { NotificationAccessContextNotFoundError } from './errors/NotificationAccessContextNotFoundError';

export class NotificationAccessContexts {
  private readonly sessions = new Map<string, Session>();

  private isOlderThanCurrent(session: Session, current: Session): boolean {
    const incomingTimestamp = session.keychain?.timestamp;
    const currentTimestamp = current.keychain?.timestamp;

    if (currentTimestamp === undefined) return false;

    if (incomingTimestamp === undefined) return true;

    return incomingTimestamp < currentTimestamp;
  }

  public find(recipientIdentityId: NotificationRecipientId): Session {
    const session = this.sessions.get(recipientIdentityId.toString());

    if (!session) throw new NotificationAccessContextNotFoundError();

    return session;
  }

  public register(session: Session): void {
    const current = this.sessions.get(session.identity.id);

    if (current && this.isOlderThanCurrent(session, current)) return;

    this.sessions.set(session.identity.id, session);
  }

  public replace(
    recipientIdentityId: NotificationRecipientId,
    session: Session,
  ): void {
    this.sessions.set(recipientIdentityId.toString(), session);
  }
}
