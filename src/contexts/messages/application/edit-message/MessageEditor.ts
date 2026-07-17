import type { Message } from '../../domain/Message';
import type { MessageRepository } from '../../domain/repositories/MessageRepository';

import { EditMessageMessage } from './messages/EditMessageMessage';

export class MessageEditor {
  public constructor(private readonly messageRepository: MessageRepository) {}

  public async edit(message: EditMessageMessage): Promise<Message> {
    const aggregate = await this.messageRepository.find(
      message.getConversationId(),
      message.getMessageId(),
      message.getAuthorId(),
    );

    aggregate.edit(
      message.getAuthorId(),
      message.getContent(),
      message.getOccurredAt(),
    );

    return await this.messageRepository.save(aggregate, message.getAuthorId());
  }
}
