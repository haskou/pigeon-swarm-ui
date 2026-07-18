import type { PinnedMessage } from '../../domain/entities/PinnedMessage';
import type { MessageRepository } from '../../domain/repositories/MessageRepository';

import { ListMessagePinsMessage } from './messages/ListMessagePinsMessage';

export class PinnedMessagesSearcher {
  public constructor(private readonly messageRepository: MessageRepository) {}

  public async search(
    message: ListMessagePinsMessage,
  ): Promise<PinnedMessage[]> {
    return await this.messageRepository.searchPinned(
      message.getConversationId(),
      message.getActorIdentityId(),
    );
  }
}
