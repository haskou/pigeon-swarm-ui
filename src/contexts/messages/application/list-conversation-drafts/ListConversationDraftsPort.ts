import type {
  ConversationDraft,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface ListConversationDraftsPort {
  listConversationDrafts(session: Session): Promise<ConversationDraft[]>;
}
