import { describe, expect, it } from '@jest/globals';

import type {
  Community,
  CommunityMembershipRequest,
} from '../../../../../shared/domain/pigeonResources.types';

import { WorkspaceInboxState } from '../../../../../app/presentation/workspace/components/WorkspaceInboxState';

describe(WorkspaceInboxState.name, () => {
  const manageableCommunity = {
    id: 'community',
    ownerIdentityId: 'owner',
  } as Community;
  const pendingRequest = {
    communityId: 'community',
    id: 'pending',
    status: 'pending',
  } as CommunityMembershipRequest;

  it('keeps only membership requests the identity can act on', () => {
    expect(
      WorkspaceInboxState.actionableMembershipRequests(
        [pendingRequest],
        [manageableCommunity],
        'owner',
      ),
    ).toEqual([pendingRequest]);
    expect(
      WorkspaceInboxState.actionableMembershipRequests(
        [pendingRequest],
        [manageableCommunity],
        'member',
      ),
    ).toEqual([]);
  });

  it('counts unseen requests together with unread notifications', () => {
    expect(
      WorkspaceInboxState.unseenMembershipRequestCount(
        [pendingRequest, { ...pendingRequest, id: 'seen' }],
        ['seen'],
      ),
    ).toBe(1);
    expect(WorkspaceInboxState.notificationCount(2, 1)).toBe(3);
  });
});
