import type {
  ChatMessage,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface LoadMessageThreadPort {
  loadMessageThread(
    session: Session,
    conversationId: string,
    messageId: string,
    options?: { limit?: number },
  ): Promise<{ messages: ChatMessage[]; nextBeforeMessageId?: null | string }>;
}
