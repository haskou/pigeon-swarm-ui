import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';
import type {
  ConversationResource,
  IdentityPresence,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export type WorkspaceInspectorDialog = {
  activeConversation?: ConversationResource;
  activeConversationPeerIdentityId?: string;
  identityNames: Record<string, string>;
  identityPictures: Record<string, string>;
  identityProfiles: Record<string, IdentityResource>;
  nodeNetworks: NodeNetwork[];
  onClose: () => void;
  onGroupInviteOpen: () => void;
  onOpenConversationWithIdentity?: (
    identityId: string,
    identity?: IdentityResource,
    networkId?: string,
  ) => Promise<void>;
  open: boolean;
  presenceByIdentityId: Record<string, IdentityPresence>;
  session: Session;
};
