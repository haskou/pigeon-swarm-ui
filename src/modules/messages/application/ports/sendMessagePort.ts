import type {
  ChatMessage,
  SendMessageOptions,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface SendMessagePort {
  sendMessage(
    session: Session,
    conversationId: string,
    content: string,
    options: SendMessageOptions,
  ): Promise<ChatMessage>;
}
