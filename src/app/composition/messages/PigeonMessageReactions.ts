import type { IdentityAccessContexts } from '../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import type { MessageReactionAdder } from '../../../contexts/messages/application/add-message-reaction/MessageReactionAdder';
import type { MessageReactionRemover } from '../../../contexts/messages/application/remove-message-reaction/MessageReactionRemover';
import type { Session } from '../../../shared/domain/pigeonResources.types';

import { AddMessageReactionMessage } from '../../../contexts/messages/application/add-message-reaction/messages/AddMessageReactionMessage';
import { RemoveMessageReactionMessage } from '../../../contexts/messages/application/remove-message-reaction/messages/RemoveMessageReactionMessage';

export class PigeonMessageReactions {
  public constructor(
    private readonly identityContexts: IdentityAccessContexts,
    private readonly adder: MessageReactionAdder,
    private readonly remover: MessageReactionRemover,
  ) {}

  public async add(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    this.identityContexts.register(session);
    await this.adder.add(
      new AddMessageReactionMessage({
        authorIdentityId: session.identity.id,
        conversationId,
        emoji,
        messageId,
        occurredAt: Date.now(),
      }),
    );
  }

  public async remove(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    this.identityContexts.register(session);
    await this.remover.remove(
      new RemoveMessageReactionMessage({
        authorIdentityId: session.identity.id,
        conversationId,
        emoji,
        messageId,
        occurredAt: Date.now(),
      }),
    );
  }
}
