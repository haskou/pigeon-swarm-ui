import type { MessagePage } from '../../domain/MessagePage';
import type { MessageRepository } from '../../domain/repositories/MessageRepository';

import { LoadMessagesMessage } from './messages/LoadMessagesMessage';

export class MessagesSearcher {
  public constructor(private readonly messageRepository: MessageRepository) {}

  public async search(message: LoadMessagesMessage): Promise<MessagePage> {
    return await this.messageRepository.search(
      message.getConversationId(),
      message.getActorIdentityId(),
      message.getBeforeMessageId(),
      message.getLimit(),
    );
  }
}
