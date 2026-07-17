import type { CommunityResource } from '../../../../../contexts/communities/application/resources/CommunityResource';

import { CommunityMapper } from '../../../../../contexts/communities/infrastructure/http/CommunityMapper';

const resource = (): CommunityResource => ({
  bannedMemberIds: ['banned-a'],
  channels: [
    { createdAt: 100, id: 'voice-a', name: 'Voice', type: 'voice' },
    { createdAt: 100, id: 'text-a', name: 'old', type: 'text' },
  ],
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
      permissions: ['view_channels'],
    },
  ],
  textChannels: [
    { createdAt: 100, id: 'text-a', name: 'current', type: 'text' },
  ],
  visibility: 'private',
  voiceChannels: [
    { createdAt: 100, id: 'voice-a', name: 'Voice', type: 'voice' },
  ],
});

describe(CommunityMapper.name, () => {
  it('hydrates ordered channels and membership state at the boundary', () => {
    const mapper = new CommunityMapper();

    expect(mapper.toResource(mapper.fromResource(resource()))).toMatchObject({
      bannedMemberIds: ['banned-a'],
      channels: [
        expect.objectContaining({ id: 'voice-a' }),
        expect.objectContaining({ id: 'text-a', name: 'current' }),
      ],
      memberIds: expect.arrayContaining(['owner-a', 'member-a']),
      memberRoles: expect.arrayContaining([
        { identityId: 'member-a', roleIds: ['member-role'] },
      ]),
    });
  });
});
