import { Timestamp } from '@haskou/value-objects';

import type { DirectMessageRepository } from '../../domain/repositories/DirectMessageRepository';
import type { MessageRepository } from '../../domain/repositories/MessageRepository';

import { MessagePinChange } from '../../domain/MessagePinChange';
import { MessagePinAction } from '../../domain/value-objects/MessagePinAction';
import { PinMessageMessage } from './messages/PinMessageMessage';

export class MessagePinner {
  public constructor(
    private readonly messageRepository: MessageRepository,
    private readonly directMessageRepository: DirectMessageRepository,
  ) {}

  public async pin(message: PinMessageMessage): Promise<void> {
    const authorId = message.getAuthorId();
    const conversationId = message.getConversationId();
    const messageId = message.getMessageId();
    const occurredAt = Timestamp.now();

    // One-to-one pins live in the direct mailboxes; the node keeps none.
    if (message.getConversationType().isOneToOne()) {
      await this.directMessageRepository.pin(
        conversationId,
        MessagePinChange.create(MessagePinAction.pin(), messageId, occurredAt),
        authorId,
      );

      return;
    }

    const aggregate = await this.messageRepository.find(
      conversationId,
      messageId,
      authorId,
    );

    aggregate.pin(occurredAt);
    await this.messageRepository.save(aggregate, authorId);
  }
}
