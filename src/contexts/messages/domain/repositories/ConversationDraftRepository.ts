import type { ConversationDraft } from '../ConversationDraft';
import type { MessageAuthorId } from '../value-objects/MessageAuthorId';
import type { MessageConversationId } from '../value-objects/MessageConversationId';

export interface ConversationDraftRepository {
  create(draft: ConversationDraft): Promise<ConversationDraft>;
  delete(
    conversationId: MessageConversationId,
    actorIdentityId: MessageAuthorId,
  ): Promise<void>;
  search(actorIdentityId: MessageAuthorId): Promise<ConversationDraft[]>;
}
