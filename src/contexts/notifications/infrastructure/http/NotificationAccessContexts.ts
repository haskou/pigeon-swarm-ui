import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { NotificationRecipientId } from '../../domain/value-objects/NotificationRecipientId';

import { NotificationAccessContextNotFoundError } from './errors/NotificationAccessContextNotFoundError';

export class NotificationAccessContexts {
  private readonly sessions = new Map<string, Session>();

  public find(recipientIdentityId: NotificationRecipientId): Session {
    const session = this.sessions.get(recipientIdentityId.toString());

    if (!session) throw new NotificationAccessContextNotFoundError();

    return session;
  }

  public register(session: Session): void {
    this.sessions.set(session.identity.id, session);
  }

  public replace(
    recipientIdentityId: NotificationRecipientId,
    session: Session,
  ): void {
    this.sessions.set(recipientIdentityId.toString(), session);
  }
}
