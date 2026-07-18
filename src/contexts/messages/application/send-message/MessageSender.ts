import type { MessageRepository } from '../../domain/repositories/MessageRepository';

import { Message } from '../../domain/Message';
import { SendMessageMessage } from './messages/SendMessageMessage';

export class MessageSender {
  public constructor(private readonly messageRepository: MessageRepository) {}

  public async send(message: SendMessageMessage): Promise<Message> {
    return await this.messageRepository.create(
      Message.create(
        message.getMessageId(),
        message.getConversationId(),
        message.getAuthorId(),
        message.getContent(),
        message.getKind(),
        message.getVisibility(),
        message.getOccurredAt(),
      ),
    );
  }
}
