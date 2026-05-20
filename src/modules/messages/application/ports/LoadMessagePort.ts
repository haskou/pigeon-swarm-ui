import type {
  ChatMessage,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface LoadMessagePort {
  loadMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<ChatMessage | null>;
}
