import { Timestamp } from '@haskou/value-objects';

import type { DirectMessageRepository } from '../../domain/repositories/DirectMessageRepository';
import type { MessageRepository } from '../../domain/repositories/MessageRepository';

import { DeleteMessageMessage } from './messages/DeleteMessageMessage';

export class MessageDeleter {
  public constructor(
    private readonly messageRepository: MessageRepository,
    private readonly directMessageRepository: DirectMessageRepository,
  ) {}

  public async delete(message: DeleteMessageMessage): Promise<void> {
    const authorId = message.getAuthorId();
    const conversationId = message.getConversationId();
    const messageId = message.getMessageId();

    // One-to-one messages live in the direct mailboxes; the node keeps none.
    if (message.getConversationType().isOneToOne()) {
      await this.directMessageRepository.delete(
        conversationId,
        messageId,
        authorId,
      );

      return;
    }

    const aggregate = await this.messageRepository.find(
      conversationId,
      messageId,
      authorId,
    );

    aggregate.delete(authorId, Timestamp.now());
    await this.messageRepository.save(aggregate, authorId);
  }
}
