import type {
  ChatMessage,
  EditMessageOptions,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface EditMessagePort {
  editMessage(
    session: Session,
    conversationId: string,
    messageId: string,
    content: string,
    options: EditMessageOptions,
  ): Promise<ChatMessage>;
}
