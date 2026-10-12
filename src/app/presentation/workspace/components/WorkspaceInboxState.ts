import type { CommunityMembershipRequestResource as CommunityMembershipRequest } from '../../../../contexts/communities/infrastructure/http/resources/CommunityMembershipRequestResource';
import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';

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
