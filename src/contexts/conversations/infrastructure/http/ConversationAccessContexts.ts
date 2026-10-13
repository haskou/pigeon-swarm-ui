import type { Session } from '../../../identities/infrastructure/session/Session';
import type { ConversationId } from '../../domain/value-objects/ConversationId';
import type { ConversationParticipantId } from '../../domain/value-objects/ConversationParticipantId';
import type { ConversationResource } from './ConversationResource';

import { ConversationAccessContextNotFoundError } from './errors/ConversationAccessContextNotFoundError';

export class ConversationAccessContexts {
  private readonly openConversations = new Map<string, ConversationResource>();

  private readonly sessions = new Map<string, Session>();

  public find(identityId: ConversationParticipantId): Session {
    const session = this.sessions.get(identityId.toString());

    if (!session) throw new ConversationAccessContextNotFoundError();

    return session;
  }

  /** The conversation as the client holds it while the reader has it open. */
  public findOpen(conversationId: ConversationId): ConversationResource {
    const conversation = this.openConversations.get(conversationId.toString());

    if (!conversation) throw new ConversationAccessContextNotFoundError();

    return conversation;
  }

  public register(session: Session): void {
    this.sessions.set(session.identity.id, session);
  }

  public registerOpen(conversation: ConversationResource): void {
    this.openConversations.set(conversation.id, conversation);
  }

  public replace(
    identityId: ConversationParticipantId,
    session: Session,
  ): void {
    this.sessions.set(identityId.toString(), session);
  }
}
