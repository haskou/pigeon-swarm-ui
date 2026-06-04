import type {
  ChatMessage,
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface ListConversationsPort {
  listConversations(session: Session): Promise<ConversationResource[]>;

  loadMessages(
    session: Session,
    conversationId: string,
    before?: null | string,
    options?: { limit?: number; signal?: AbortSignal },
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }>;
}
