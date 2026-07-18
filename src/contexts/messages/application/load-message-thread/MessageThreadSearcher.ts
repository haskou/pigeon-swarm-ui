import type { MessagePage } from '../../domain/MessagePage';
import type { MessageRepository } from '../../domain/repositories/MessageRepository';

import { LoadMessageThreadMessage } from './messages/LoadMessageThreadMessage';

export class MessageThreadSearcher {
  public constructor(private readonly messageRepository: MessageRepository) {}

  public async search(message: LoadMessageThreadMessage): Promise<MessagePage> {
    return await this.messageRepository.searchThread(
      message.getConversationId(),
      message.getMessageId(),
      message.getActorIdentityId(),
      message.getLimit(),
    );
  }
}
