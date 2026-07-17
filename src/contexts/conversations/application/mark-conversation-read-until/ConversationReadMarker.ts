import type { ConversationRepository } from '../../domain/repositories/ConversationRepository';

import { MarkConversationReadUntilMessage } from './messages/MarkConversationReadUntilMessage';

export class ConversationReadMarker {
  public constructor(
    private readonly conversationRepository: ConversationRepository,
  ) {}

  public async mark(message: MarkConversationReadUntilMessage): Promise<void> {
    const actorIdentityId = message.getActorIdentityId();
    const conversation = await this.conversationRepository.find(
      message.getConversationId(),
      actorIdentityId,
    );

    conversation.markRead(message.getOccurredAt());
    await this.conversationRepository.markReadUntil(
      conversation,
      message.getMessageId(),
      actorIdentityId,
    );
  }
}
