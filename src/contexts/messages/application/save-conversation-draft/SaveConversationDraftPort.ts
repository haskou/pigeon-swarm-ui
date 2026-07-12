import type {
  ConversationDraft,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface SaveConversationDraftPort {
  saveConversationDraft(
    session: Session,
    conversationId: string,
    content: string,
    updatedAt?: number,
  ): Promise<ConversationDraft>;
}
