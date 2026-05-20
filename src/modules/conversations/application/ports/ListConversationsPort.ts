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
    limit?: number,
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }>;
}
