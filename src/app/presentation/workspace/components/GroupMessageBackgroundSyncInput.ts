import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { GroupConversationActivity } from '../../../../contexts/groupMailboxes/infrastructure/GroupConversationActivity';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

export type GroupMessageBackgroundSyncInput = {
  activeConversationId: string | null;
  conversations: ConversationResource[];
  onActivity: (
    conversationId: string,
    activity: GroupConversationActivity,
  ) => void;
  /** Receives each member that announced an identity update. */
  onIdentityUpdated: (identityId: string) => void;
  session: Session;
};
