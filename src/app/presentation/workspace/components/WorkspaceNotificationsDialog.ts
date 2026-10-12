import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';
import type {
  Community,
  CommunityMembershipRequest,
  ConversationResource,
  IdentityResource,
  NotificationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export type WorkspaceNotificationsDialog = {
  action: 'accept' | 'archive' | 'decline' | 'refresh' | null;
  archive: (notificationId: string) => void;
  communities: Community[];
  communityAvatarUrls: Record<string, string>;
  communityPreviews: Record<string, Community>;
  conversations: ConversationResource[];
  error: string | null;
  identityNames: Record<string, string>;
  identityPictures: Record<string, string>;
  identityProfiles: Record<string, IdentityResource>;
  membershipAction: 'accept' | 'decline' | 'refresh' | null;
  membershipError: string | null;
  membershipRequests: CommunityMembershipRequest[];
  nodeNetworks: NodeNetwork[];
  notifications: NotificationResource[];
  onAccept: (notification: NotificationResource) => void;
  onAcceptMembershipRequest: (requestId: string) => void;
  onClose: () => void;
  onDecline: (notificationId: string) => void;
  onDeclineMembershipRequest: (requestId: string) => void;
  open: boolean;
  session: Session;
};
