import type { CommunityDiscoveryResource } from '../../domain/CommunityDiscoveryResource';

import { communityDiscoveryCanAutoJoin } from './communityDiscoveryCanAutoJoin';

function community(
  input: Partial<CommunityDiscoveryResource>,
): CommunityDiscoveryResource {
  return {
    autoJoinEnabled: false,
    avatar: null,
    banner: null,
    description: 'Community',
    discoverable: true,
    id: 'community-1',
    memberCount: 1,
    membershipStatus: 'none',
    name: 'Community',
    networkId: 'network-1',
    ownerIdentityId: 'identity-1',
    visibility: 'private',
    ...input,
  };
}

describe(communityDiscoveryCanAutoJoin.name, () => {
  it('allows instant join for public communities with auto join enabled', () => {
    expect(
      communityDiscoveryCanAutoJoin(
        community({ autoJoinEnabled: true, visibility: 'public' }),
      ),
    ).toBe(true);
  });

  it('rejects stale auto join flags on private communities', () => {
    expect(
      communityDiscoveryCanAutoJoin(
        community({ autoJoinEnabled: true, visibility: 'private' }),
      ),
    ).toBe(false);
  });
});
