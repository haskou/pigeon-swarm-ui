import type { Message } from '../../domain/Message';
import type { MessageRepository } from '../../domain/repositories/MessageRepository';

import { LoadMessageMessage } from './messages/LoadMessageMessage';

export class MessageFinder {
  public constructor(private readonly messageRepository: MessageRepository) {}

  public async find(message: LoadMessageMessage): Promise<Message> {
    return await this.messageRepository.find(
      message.getConversationId(),
      message.getMessageId(),
      message.getActorIdentityId(),
    );
  }
}
