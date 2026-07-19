import { useCallback, useEffect, useMemo, useState } from 'react';

import type { useCommunityMembershipRequests } from '../../../../contexts/communities/presentation/hooks/useCommunityMembershipRequests';
import type { useNotifications } from '../../../../contexts/notifications/presentation/hooks/useNotifications';
import type {
  Community,
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { SeenCommunityMembershipRequests } from '../../../../contexts/communities/infrastructure/storage/SeenCommunityMembershipRequests';
import { useCommunityMembershipRequests as useMembershipRequests } from '../../../../contexts/communities/presentation/hooks/useCommunityMembershipRequests';
import { useNotificationCommunityPreviews } from '../../../../contexts/notifications/presentation/hooks/useNotificationCommunityPreviews';
import { useNotifications as useNotificationList } from '../../../../contexts/notifications/presentation/hooks/useNotifications';
import { WorkspaceInboxState } from './WorkspaceInboxState';

type NotificationController = ReturnType<typeof useNotifications>;
type MembershipRequestController = ReturnType<
  typeof useCommunityMembershipRequests
>;

type AcceptedNotificationState = {
  communities?: Community[];
  communityId?: string;
  conversationId?: string;
  conversations?: ConversationResource[];
  session: Session;
};

type UseWorkspaceInboxInput = {
  communities: Community[];
  notificationsOpen: boolean;
  onAccepted: (state: AcceptedNotificationState) => void;
  onAcceptedPanelClose: () => void;
  onCommunitiesReload: () => Promise<void>;
  session: Session;
};

export type WorkspaceInboxController = {
  communityAvatarUrls: Record<string, string>;
  communityPreviews: Record<string, Community>;
  membershipRequests: MembershipRequestController;
  notificationCount: number;
  notifications: NotificationController;
};

const seenCommunityMembershipRequests = new SeenCommunityMembershipRequests();

export function useWorkspaceInbox({
  communities,
  notificationsOpen,
  onAccepted,
  onAcceptedPanelClose,
  onCommunitiesReload,
  session,
}: UseWorkspaceInboxInput): WorkspaceInboxController {
  const [seenMembershipRequestIds, setSeenMembershipRequestIds] = useState<
    string[]
  >(() => seenCommunityMembershipRequests.get(session.identity.id));
  const notifications = useNotificationList({
    onAccepted,
    onAcceptedPanelClose,
    session,
  });
  const membershipRequests = useMembershipRequests({
    onCommunitiesReload,
    session,
  });
  const actionableMembershipRequests = useMemo(
    () =>
      WorkspaceInboxState.actionableMembershipRequests(
        membershipRequests.requests,
        communities,
        session.identity.id,
      ),
    [communities, membershipRequests.requests, session.identity.id],
  );
  const unseenMembershipRequestCount = useMemo(
    () =>
      WorkspaceInboxState.unseenMembershipRequestCount(
        actionableMembershipRequests,
        seenMembershipRequestIds,
      ),
    [actionableMembershipRequests, seenMembershipRequestIds],
  );
  const markVisibleMembershipRequestsAsSeen = useCallback((): void => {
    const requestIds = actionableMembershipRequests.map(
      (request) => request.id,
    );

    if (requestIds.length === 0) return;

    setSeenMembershipRequestIds(
      seenCommunityMembershipRequests.markSeen(session.identity.id, requestIds),
    );
  }, [actionableMembershipRequests, session.identity.id]);

  useEffect(() => {
    setSeenMembershipRequestIds(
      seenCommunityMembershipRequests.get(session.identity.id),
    );
  }, [session.identity.id]);

  useEffect(() => {
    if (!notificationsOpen) return;

    notifications.markVisibleAsSeen();
    markVisibleMembershipRequestsAsSeen();
  }, [
    markVisibleMembershipRequestsAsSeen,
    notifications.markVisibleAsSeen,
    notificationsOpen,
  ]);

  const { communityAvatarUrls, communityPreviews } =
    useNotificationCommunityPreviews({
      communities,
      session,
      visibleNotifications: notifications.visible,
    });

  return {
    communityAvatarUrls,
    communityPreviews,
    membershipRequests,
    notificationCount: WorkspaceInboxState.notificationCount(
      notifications.unreadCount,
      unseenMembershipRequestCount,
    ),
    notifications,
  };
}
