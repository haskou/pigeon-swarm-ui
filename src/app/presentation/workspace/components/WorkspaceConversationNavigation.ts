import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { ConversationKeyEntry } from '../../../../contexts/identities/infrastructure/keychain/ConversationKeyEntry';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

export type WorkspaceConversationNavigation = {
  importConversationKey: (keyEntry: ConversationKeyEntry) => Promise<void>;
  openCreatedConversation: (
    session: Session,
    conversation: ConversationResource,
  ) => void;
  openOrCreateConversation: (
    identityId: string,
    identity?: IdentityResource,
    preferredNetworkId?: string,
  ) => Promise<void>;
};
