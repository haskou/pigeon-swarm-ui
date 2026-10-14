import type { ConversationReadReceiptRepository } from '../../domain/repositories/ConversationReadReceiptRepository';

import { MarkConversationReadUntilMessage } from './messages/MarkConversationReadUntilMessage';

export class ConversationReadMarker {
  public constructor(
    private readonly readReceiptRepository: ConversationReadReceiptRepository,
  ) {}

  /**
   * A read of the open one-to-one conversation goes to the reader's own inbox
   * as a read record. Any other read, including every group read, stays on
   * this device: the node cannot know the read state of sealed content.
   */
  public async mark(message: MarkConversationReadUntilMessage): Promise<void> {
    const conversationId = message.getConversationId();
    const openConversation = message.getOpenConversation();

    if (
      !openConversation?.id.isEqual(conversationId) ||
      !openConversation.type.isOneToOne()
    ) {
      return;
    }

    await this.readReceiptRepository.markRead(
      conversationId,
      message.getMessageId(),
      message.getActorIdentityId(),
    );
  }
}
