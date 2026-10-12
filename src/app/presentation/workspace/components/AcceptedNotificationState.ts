import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

export type AcceptedNotificationState = {
  communities?: Community[];
  communityId?: string;
  conversationId?: string;
  conversations?: ConversationResource[];
  session: Session;
};
