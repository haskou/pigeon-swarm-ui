import type { ConversationDraft } from '../../domain/ConversationDraft';
import type { ConversationDraftRepository } from '../../domain/repositories/ConversationDraftRepository';

import { ListConversationDraftsMessage } from './messages/ListConversationDraftsMessage';

export class ConversationDraftsSearcher {
  public constructor(
    private readonly conversationDraftRepository: ConversationDraftRepository,
  ) {}

  public async search(
    message: ListConversationDraftsMessage,
  ): Promise<ConversationDraft[]> {
    return await this.conversationDraftRepository.search(
      message.getActorIdentityId(),
    );
  }
}
