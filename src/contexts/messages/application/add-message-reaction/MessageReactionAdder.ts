import { Timestamp } from '@haskou/value-objects';

import type { DirectMessageRepository } from '../../domain/repositories/DirectMessageRepository';
import type { MessageRepository } from '../../domain/repositories/MessageRepository';

import { MessageReactionChange } from '../../domain/MessageReactionChange';
import { MessageReactionAction } from '../../domain/value-objects/MessageReactionAction';
import { AddMessageReactionMessage } from './messages/AddMessageReactionMessage';

export class MessageReactionAdder {
  public constructor(
    private readonly messageRepository: MessageRepository,
    private readonly directMessageRepository: DirectMessageRepository,
  ) {}

  public async add(message: AddMessageReactionMessage): Promise<void> {
    const authorId = message.getAuthorId();
    const conversationId = message.getConversationId();
    const emoji = message.getEmoji();
    const messageId = message.getMessageId();
    const occurredAt = Timestamp.now();

    // One-to-one reactions live in the direct mailboxes; the node keeps none.
    if (message.getConversationType().isOneToOne()) {
      await this.directMessageRepository.react(
        conversationId,
        MessageReactionChange.create(
          MessageReactionAction.add(),
          emoji,
          messageId,
          occurredAt,
        ),
        authorId,
      );

      return;
    }

    const aggregate = await this.messageRepository.find(
      conversationId,
      messageId,
      authorId,
    );

    aggregate.addReaction(authorId, emoji, occurredAt);
    await this.messageRepository.save(aggregate, authorId);
  }
}
