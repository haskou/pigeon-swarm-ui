import type { ConversationAccessContexts } from '../../../contexts/conversations/infrastructure/http/ConversationAccessContexts';
import type { ConversationResource } from '../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { IdentityAccessContexts } from '../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import type { Session } from '../../../contexts/identities/infrastructure/session/Session';
import type { MessageReactionAdder } from '../../../contexts/messages/application/add-message-reaction/MessageReactionAdder';
import type { MessageReactionRemover } from '../../../contexts/messages/application/remove-message-reaction/MessageReactionRemover';

import { AddMessageReactionMessage } from '../../../contexts/messages/application/add-message-reaction/messages/AddMessageReactionMessage';
import { RemoveMessageReactionMessage } from '../../../contexts/messages/application/remove-message-reaction/messages/RemoveMessageReactionMessage';

export class PigeonMessageReactions {
  public constructor(
    private readonly identityContexts: IdentityAccessContexts,
    private readonly conversationContexts: ConversationAccessContexts,
    private readonly adder: MessageReactionAdder,
    private readonly remover: MessageReactionRemover,
  ) {}

  private reactionInput(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
    emoji: string,
  ) {
    this.identityContexts.register(session);
    this.conversationContexts.registerOpen(conversation);

    return {
      authorIdentityId: session.identity.id,
      conversationId: conversation.id,
      conversationType: conversation.type,
      emoji,
      messageId,
    };
  }

  public async add(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.adder.add(
      new AddMessageReactionMessage(
        this.reactionInput(session, conversation, messageId, emoji),
      ),
    );
  }

  public async remove(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.remover.remove(
      new RemoveMessageReactionMessage(
        this.reactionInput(session, conversation, messageId, emoji),
      ),
    );
  }
}
