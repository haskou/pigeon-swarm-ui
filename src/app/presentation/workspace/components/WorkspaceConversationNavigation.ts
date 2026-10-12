import type {
  ConversationKeyEntry,
  ConversationResource,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

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
