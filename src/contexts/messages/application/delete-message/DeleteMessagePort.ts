import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface DeleteMessagePort {
  deleteMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void>;
}
