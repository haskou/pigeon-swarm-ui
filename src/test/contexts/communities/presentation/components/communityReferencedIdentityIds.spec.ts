import type {
  CommunityMembershipRequest,
  CommunityModerationLog,
} from '../../../../../shared/domain/pigeonResources.types';

import { communityReferencedIdentityIds } from '../../../../../contexts/communities/presentation/components/communityReferencedIdentityIds';

function log(
  overrides: Partial<CommunityModerationLog> &
    Pick<CommunityModerationLog, 'actorIdentityId' | 'target'>,
): CommunityModerationLog {
  return {
    action: 'member_banned',
    communityId: 'community-id',
    createdAt: 1,
    id: 'log-id',
    ...overrides,
  };
}

function request(
  overrides: Partial<CommunityMembershipRequest> &
    Pick<CommunityMembershipRequest, 'creatorIdentityId' | 'identityId'>,
): CommunityMembershipRequest {
  return {
    communityId: 'community-id',
    createdAt: 1,
    id: 'request-id',
    status: 'pending',
    type: 'request',
    updatedAt: 1,
    ...overrides,
  };
}

describe('communityReferencedIdentityIds', () => {
  it('returns nothing when nothing references an identity', () => {
    expect(communityReferencedIdentityIds({})).toEqual([]);
  });

  it('includes banned members so the banned list can show their names', () => {
    expect(
      communityReferencedIdentityIds({ bannedMemberIds: ['banned-a', 'b'] }),
    ).toEqual(['banned-a', 'b']);
  });

  it('includes moderation log actors and member targets only', () => {
    expect(
      communityReferencedIdentityIds({
        moderationLogs: [
          log({
            actorIdentityId: 'owner',
            target: { id: 'kicked', type: 'member' },
          }),
          log({
            actorIdentityId: 'owner',
            target: { id: 'channel-id', type: 'channel' },
          }),
          log({
            actorIdentityId: 'helper',
            target: { id: 'role-id', type: 'role' },
          }),
        ],
      }),
    ).toEqual(['owner', 'kicked', 'helper']);
  });

  it('includes membership request participants and de-duplicates', () => {
    expect(
      communityReferencedIdentityIds({
        bannedMemberIds: ['owner'],
        membershipRequests: [
          request({ creatorIdentityId: 'owner', identityId: 'invitee' }),
        ],
        moderationLogs: [
          log({
            actorIdentityId: 'owner',
            target: { id: 'invitee', type: 'member' },
          }),
        ],
      }),
    ).toEqual(['owner', 'invitee']);
  });
});
