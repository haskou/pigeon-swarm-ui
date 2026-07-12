import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface MarkConversationReadUntilPort {
  markConversationReadUntil(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void>;
}
