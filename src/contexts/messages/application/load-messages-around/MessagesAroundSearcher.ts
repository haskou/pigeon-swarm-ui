import type { MessagePage } from '../../domain/MessagePage';
import type { MessageRepository } from '../../domain/repositories/MessageRepository';

import { LoadMessagesAroundMessage } from './messages/LoadMessagesAroundMessage';

export class MessagesAroundSearcher {
  public constructor(private readonly messageRepository: MessageRepository) {}

  public async search(
    message: LoadMessagesAroundMessage,
  ): Promise<MessagePage> {
    return await this.messageRepository.searchAround(
      message.getConversationId(),
      message.getMessageId(),
      message.getActorIdentityId(),
    );
  }
}
