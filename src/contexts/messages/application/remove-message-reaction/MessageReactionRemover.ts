import type { MessageRepository } from '../../domain/repositories/MessageRepository';

import { RemoveMessageReactionMessage } from './messages/RemoveMessageReactionMessage';

export class MessageReactionRemover {
  public constructor(private readonly messageRepository: MessageRepository) {}

  public async remove(message: RemoveMessageReactionMessage): Promise<void> {
    const aggregate = await this.messageRepository.find(
      message.getConversationId(),
      message.getMessageId(),
      message.getAuthorId(),
    );

    aggregate.removeReaction(
      message.getAuthorId(),
      message.getEmoji(),
      message.getOccurredAt(),
    );
    await this.messageRepository.save(aggregate, message.getAuthorId());
  }
}
