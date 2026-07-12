import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface DeleteConversationDraftPort {
  deleteConversationDraft(
    session: Session,
    conversationId: string,
  ): Promise<void>;
}
