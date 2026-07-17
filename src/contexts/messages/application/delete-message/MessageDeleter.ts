import type { MessageRepository } from '../../domain/repositories/MessageRepository';

import { DeleteMessageMessage } from './messages/DeleteMessageMessage';

export class MessageDeleter {
  public constructor(private readonly messageRepository: MessageRepository) {}

  public async delete(message: DeleteMessageMessage): Promise<void> {
    const aggregate = await this.messageRepository.find(
      message.getConversationId(),
      message.getMessageId(),
      message.getAuthorId(),
    );

    aggregate.delete(message.getAuthorId(), message.getOccurredAt());
    await this.messageRepository.save(aggregate, message.getAuthorId());
  }
}
