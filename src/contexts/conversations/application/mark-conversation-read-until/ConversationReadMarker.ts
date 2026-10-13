import type { ConversationReadReceiptRepository } from '../../domain/repositories/ConversationReadReceiptRepository';
import type { ConversationRepository } from '../../domain/repositories/ConversationRepository';

import { MarkConversationReadUntilMessage } from './messages/MarkConversationReadUntilMessage';

export class ConversationReadMarker {
  public constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly readReceiptRepository: ConversationReadReceiptRepository,
  ) {}

  public async mark(message: MarkConversationReadUntilMessage): Promise<void> {
    const actorIdentityId = message.getActorIdentityId();
    const conversationId = message.getConversationId();
    const openConversation = message.getOpenConversation();

    // A read of the open one-to-one conversation goes to the reader's own
    // inbox as a read record.
    if (
      openConversation?.id.isEqual(conversationId) &&
      openConversation.type.isOneToOne()
    ) {
      await this.readReceiptRepository.markRead(
        conversationId,
        message.getMessageId(),
        actorIdentityId,
      );

      return;
    }

    const conversation = await this.conversationRepository.find(
      conversationId,
      actorIdentityId,
    );

    // One-to-one reads go through the own-inbox read record, never through
    // the conversation read-until endpoint.
    if (!conversation.isGroup()) return;

    conversation.markRead(message.getOccurredAt());
    await this.conversationRepository.markReadUntil(
      conversation,
      message.getMessageId(),
      actorIdentityId,
    );
  }
}
