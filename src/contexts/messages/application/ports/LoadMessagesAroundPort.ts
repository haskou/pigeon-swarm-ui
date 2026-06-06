import type {
  ChatMessage,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface LoadMessagesAroundPort {
  loadMessagesAround(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<{
    messages: ChatMessage[];
    nextCursor?: null | string;
    previousCursor?: null | string;
  }>;
}
