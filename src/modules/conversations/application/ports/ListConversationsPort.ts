import type {
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface ListConversationsPort {
  listConversations(session: Session): Promise<ConversationResource[]>;
}
