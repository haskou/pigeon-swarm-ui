import type { ConversationDraftRepository } from '../../domain/repositories/ConversationDraftRepository';

import { ConversationDraft } from '../../domain/ConversationDraft';
import { SaveConversationDraftMessage } from './messages/SaveConversationDraftMessage';

export class ConversationDraftSaver {
  public constructor(
    private readonly conversationDraftRepository: ConversationDraftRepository,
  ) {}

  public async save(
    message: SaveConversationDraftMessage,
  ): Promise<ConversationDraft> {
    return await this.conversationDraftRepository.create(
      ConversationDraft.create(
        message.getConversationId(),
        message.getAuthorId(),
        message.getContent(),
        message.getUpdatedAt(),
      ),
    );
  }
}
