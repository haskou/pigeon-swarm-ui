import type { CommunityMembershipRequestResource as CommunityMembershipRequest } from '../../../../contexts/communities/infrastructure/http/resources/CommunityMembershipRequestResource';
import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';

export type WorkspaceCreationDialogs = {
  conversations: ConversationResource[];
  createCommunityOpen: boolean;
  createConversationOpen: boolean;
  nodeNetworks: NodeNetwork[];
  nodeNetworksLoading: boolean;
  nodeNetworksLoadError: boolean;
  onCloseCommunity: () => void;
  onCloseConversation: () => void;
  onCommunityCreated: (input: {
    community: Community;
    session: Session;
  }) => void;
  onCommunityJoinRequested: (request: CommunityMembershipRequest) => void;
  onConversationCreated: (
    nextSession: Session,
    conversation: ConversationResource,
  ) => void;
  session: Session;
};
