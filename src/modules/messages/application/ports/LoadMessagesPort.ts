import type {
  ChatMessage,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface LoadMessagesPort {
  loadMessages(
    session: Session,
    conversationId: string,
    before?: null | string,
    options?: { signal?: AbortSignal },
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }>;
}
