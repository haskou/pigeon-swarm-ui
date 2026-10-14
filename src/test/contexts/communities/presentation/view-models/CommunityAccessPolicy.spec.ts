import type { CommunityResource } from '../../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { CommunityTextChannelResource } from '../../../../../contexts/communities/infrastructure/http/resources/CommunityTextChannelResource';

import {
  ALL_COMMUNITY_PERMISSIONS,
  CommunityAccessPolicy,
} from '../../../../../contexts/communities/presentation/view-models/CommunityAccessPolicy';

const OWNER = 'MCowBQYDK2VwAyEAowner';
const MEMBER = 'MCowBQYDK2VwAyEAmember';
const pem = (identityId: string): string =>
  `-----BEGIN PUBLIC KEY-----\n${identityId}\n-----END PUBLIC KEY-----\n`;
const community = (
  overrides: Partial<CommunityResource> = {},
): CommunityResource => ({
  createdAt: 0,
  description: '',
  id: 'community-1',
  memberIds: [OWNER, MEMBER],
  memberRoles: [{ identityId: pem(MEMBER), roleIds: ['moderator'] }],
  name: 'Community',
  networkId: 'network-1',
  ownerIdentityId: pem(OWNER),
  roles: [
    { id: 'everyone', name: 'everyone', permissions: ['view_channels'] },
    { id: 'moderator', name: 'Moderator', permissions: ['manage_messages'] },
  ],
  textChannels: [],
  visibility: 'public',
  ...overrides,
});
const restricted: CommunityTextChannelResource = {
  createdAt: 0,
  id: 'channel-1',
  name: 'staff',
  permissions: { visibleRoleIds: ['staff'] },
  type: 'text',
};

describe(CommunityAccessPolicy.name, () => {
  it('recognises the owner whose id is stored in PEM form', () => {
    expect(CommunityAccessPolicy.isOwner(community(), OWNER)).toBe(true);
  });

  it('does not treat a member or a rejected id as the owner', () => {
    expect(CommunityAccessPolicy.isOwner(community(), MEMBER)).toBe(false);
    expect(
      CommunityAccessPolicy.isOwner(
        community({ ownerIdentityId: 'x'.repeat(5000) }),
        'x'.repeat(5000),
      ),
    ).toBe(false);
  });

  it('grants the PEM-form owner every permission', () => {
    expect([
      ...CommunityAccessPolicy.permissionsFor(community(), OWNER),
    ]).toEqual(ALL_COMMUNITY_PERMISSIONS);
  });

  it('shows a restricted channel to the PEM-form owner only', () => {
    expect(
      CommunityAccessPolicy.canSeeChannel(community(), restricted, OWNER),
    ).toBe(true);
    expect(
      CommunityAccessPolicy.canSeeChannel(community(), restricted, MEMBER),
    ).toBe(false);
  });

  it('finds the roles assigned to a member keyed in PEM form', () => {
    expect([
      ...CommunityAccessPolicy.assignedRoleIdsFor(community(), MEMBER),
    ]).toEqual(['everyone', 'moderator']);
    expect(
      CommunityAccessPolicy.permissionsFor(community(), MEMBER).has(
        'manage_messages',
      ),
    ).toBe(true);
  });
});
