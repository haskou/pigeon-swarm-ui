import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';
import type {
  Community,
  CommunityMembershipRequest,
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export type WorkspaceCreationDialogs = {
  conversations: ConversationResource[];
  createCommunityOpen: boolean;
  createConversationOpen: boolean;
  nodeNetworks: NodeNetwork[];
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
