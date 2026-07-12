import type { DeleteConversationDraftPort } from './DeleteConversationDraftPort';

import { DeleteConversationDraftMessage } from './messages/DeleteConversationDraftMessage';

export class DeleteConversationDraft {
  public constructor(private readonly drafts: DeleteConversationDraftPort) {}

  public async delete(message: DeleteConversationDraftMessage): Promise<void> {
    await this.drafts.deleteConversationDraft(
      message.getSession(),
      message.getConversationId(),
    );
  }
}
