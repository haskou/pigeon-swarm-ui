import type {
  Community,
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export type AcceptedNotificationState = {
  communities?: Community[];
  communityId?: string;
  conversationId?: string;
  conversations?: ConversationResource[];
  session: Session;
};
