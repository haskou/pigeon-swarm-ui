import type { MessageRepository } from '../../domain/repositories/MessageRepository';

import { PinMessageMessage } from './messages/PinMessageMessage';

export class MessagePinner {
  public constructor(private readonly messageRepository: MessageRepository) {}

  public async pin(message: PinMessageMessage): Promise<void> {
    const aggregate = await this.messageRepository.find(
      message.getConversationId(),
      message.getMessageId(),
      message.getAuthorId(),
    );

    aggregate.pin(message.getOccurredAt());
    await this.messageRepository.save(aggregate, message.getAuthorId());
  }
}
