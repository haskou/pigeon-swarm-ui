import type { ConversationDraft } from '../../../../shared/domain/pigeonResources.types';
import type { SaveConversationDraftPort } from './SaveConversationDraftPort';

import { SaveConversationDraftMessage } from './messages/SaveConversationDraftMessage';

export class SaveConversationDraft {
  public constructor(private readonly drafts: SaveConversationDraftPort) {}

  public async save(
    message: SaveConversationDraftMessage,
  ): Promise<ConversationDraft> {
    return await this.drafts.saveConversationDraft(
      message.getSession(),
      message.getConversationId(),
      message.getContent(),
      message.getUpdatedAt(),
    );
  }
}
