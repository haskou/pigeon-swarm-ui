import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { IdentityPresenceResource as IdentityPresence } from '../../../../contexts/identities/infrastructure/http/resources/IdentityPresenceResource';
import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';

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
