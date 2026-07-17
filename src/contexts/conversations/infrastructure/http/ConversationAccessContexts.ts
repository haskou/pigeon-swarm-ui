import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { ConversationParticipantId } from '../../domain/value-objects/ConversationParticipantId';

import { ConversationAccessContextNotFoundError } from './errors/ConversationAccessContextNotFoundError';

export class ConversationAccessContexts {
  private readonly sessions = new Map<string, Session>();

  public find(identityId: ConversationParticipantId): Session {
    const session = this.sessions.get(identityId.toString());

    if (!session) throw new ConversationAccessContextNotFoundError();

    return session;
  }

  public register(session: Session): void {
    this.sessions.set(session.identity.id, session);
  }

  public replace(
    identityId: ConversationParticipantId,
    session: Session,
  ): void {
    this.sessions.set(identityId.toString(), session);
  }
}
