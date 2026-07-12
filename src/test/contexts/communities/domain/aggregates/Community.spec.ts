import type {
  Community as CommunityResource,
  CommunityChannel,
} from '../../../../../shared/domain/pigeonResources.types';

import { Community } from '../../../../../contexts/communities/domain/aggregates/Community';
import { CommunityIdentityId } from '../../../../../contexts/communities/domain/value-objects/CommunityIdentityId';
import { CommunityName } from '../../../../../contexts/communities/domain/value-objects/CommunityName';

const visibleChannel: CommunityChannel = {
  createdAt: 100,
  id: 'channel-a',
  name: 'general',
  permissions: { visibleRoleIds: ['member-role'] },
  type: 'text',
};

const communityResource = (
  overrides: Partial<CommunityResource> = {},
): CommunityResource => ({
  createdAt: 100,
  description: 'A community',
  id: 'community-a',
  memberIds: ['owner-a', 'member-a'],
  memberRoles: [{ identityId: 'member-a', roleIds: ['member-role'] }],
  name: 'Builders',
  networkId: 'network-a',
  ownerIdentityId: 'owner-a',
  roles: [
    {
      id: 'member-role',
      name: 'Member',
      permissions: ['view_channels', 'send_messages'],
    },
  ],
  textChannels: [visibleChannel],
  visibility: 'private',
  ...overrides,
});

describe('Community', () => {
  it('keeps channel visibility as aggregate behavior', () => {
    const community = Community.fromResource(communityResource());

    expect(community.canSeeChannel(visibleChannel, 'member-a')).toBe(true);
    expect(community.membersWithChannelAccess(visibleChannel)).toEqual([
      'owner-a',
      'member-a',
    ]);
  });

  it('renames a community with a value object', () => {
    const community = Community.fromResource(communityResource());
    const ownerId = CommunityIdentityId.fromString('owner-a');
    const name = CommunityName.fromString('Operators');

    community.rename(name);

    expect(community.isOwnedBy(ownerId)).toBe(true);
    expect(community.getName().isEqual(name)).toBe(true);
    expect(community.pullDomainEvents()).toHaveLength(1);
  });
});
