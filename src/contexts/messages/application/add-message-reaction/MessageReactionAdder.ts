import type { MessageRepository } from '../../domain/repositories/MessageRepository';

import { AddMessageReactionMessage } from './messages/AddMessageReactionMessage';

export class MessageReactionAdder {
  public constructor(private readonly messageRepository: MessageRepository) {}

  public async add(message: AddMessageReactionMessage): Promise<void> {
    const aggregate = await this.messageRepository.find(
      message.getConversationId(),
      message.getMessageId(),
      message.getAuthorId(),
    );

    aggregate.addReaction(
      message.getAuthorId(),
      message.getEmoji(),
      message.getOccurredAt(),
    );
    await this.messageRepository.save(aggregate, message.getAuthorId());
  }
}
