import type { MessageRepository } from '../../domain/repositories/MessageRepository';

import { UnpinMessageMessage } from './messages/UnpinMessageMessage';

export class MessageUnpinner {
  public constructor(private readonly messageRepository: MessageRepository) {}

  public async unpin(message: UnpinMessageMessage): Promise<void> {
    const aggregate = await this.messageRepository.find(
      message.getConversationId(),
      message.getMessageId(),
      message.getAuthorId(),
    );

    aggregate.unpin(message.getOccurredAt());
    await this.messageRepository.save(aggregate, message.getAuthorId());
  }
}
