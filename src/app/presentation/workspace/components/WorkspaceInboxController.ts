import type { CommunityMembershipRequestsController } from '../../../../contexts/communities/presentation/hooks/useCommunityMembershipRequests';
import type { NotificationController } from '../../../../contexts/notifications/presentation/hooks/useNotifications';
import type { Community } from '../../../../shared/domain/pigeonResources.types';

export type WorkspaceInboxController = {
  communityAvatarUrls: Record<string, string>;
  communityPreviews: Record<string, Community>;
  membershipRequests: CommunityMembershipRequestsController;
  notificationCount: number;
  notifications: NotificationController;
  onOpen: () => void;
};
