import type { ConversationDraft } from '../../../../shared/domain/pigeonResources.types';
import type { ListConversationDraftsPort } from './ListConversationDraftsPort';

import { ListConversationDraftsMessage } from './messages/ListConversationDraftsMessage';

export class ListConversationDrafts {
  public constructor(private readonly drafts: ListConversationDraftsPort) {}

  public async list(
    message: ListConversationDraftsMessage,
  ): Promise<ConversationDraft[]> {
    return await this.drafts.listConversationDrafts(message.getSession());
  }
}
