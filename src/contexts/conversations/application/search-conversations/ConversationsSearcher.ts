import type { Conversation } from '../../domain/Conversation';
import type { ConversationRepository } from '../../domain/repositories/ConversationRepository';

import { SearchConversationsMessage } from './messages/SearchConversationsMessage';

export class ConversationsSearcher {
  public constructor(
    private readonly conversationRepository: ConversationRepository,
  ) {}

  public async search(
    message: SearchConversationsMessage,
  ): Promise<Conversation[]> {
    return await this.conversationRepository.searchByIdentity(
      message.getIdentityId(),
    );
  }
}
