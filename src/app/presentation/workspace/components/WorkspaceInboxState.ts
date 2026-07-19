import type {
  Community,
  CommunityMembershipRequest,
} from '../../../../shared/domain/pigeonResources.types';

import { canActOnMembershipRequest } from './workspaceNotificationState';

export class WorkspaceInboxState {
  public static actionableMembershipRequests(
    requests: CommunityMembershipRequest[],
    communities: Community[],
    identityId: string,
  ): CommunityMembershipRequest[] {
    return requests.filter((request) =>
      canActOnMembershipRequest(request, communities, identityId),
    );
  }

  public static unseenMembershipRequestCount(
    requests: CommunityMembershipRequest[],
    seenRequestIds: string[],
  ): number {
    return requests.filter((request) => !seenRequestIds.includes(request.id))
      .length;
  }

  public static notificationCount(
    unreadNotificationCount: number,
    unseenMembershipRequestCount: number,
  ): number {
    return unreadNotificationCount + unseenMembershipRequestCount;
  }
}
