import type { CommunityRepository } from '../../../contexts/communities/domain/repositories/CommunityRepository';

import { Community } from '../../../contexts/communities/domain/Community';

export const communityFixture = (): Community =>
  Community.fromPrimitives({
    channels: [
      {
        connectedIdentityIds: [],
        createdAt: 100,
        id: 'channel-a',
        name: 'general',
        type: 'text',
        visibleRoleIds: ['everyone'],
      },
    ],
    members: [
      { banned: false, identityId: 'owner-a', roleIds: [] },
      { banned: false, identityId: 'member-a', roleIds: ['member-role'] },
    ],
    metadata: {
      createdAt: 100,
      id: 'community-a',
      networkId: 'network-a',
      ownerIdentityId: 'owner-a',
    },
    profile: {
      avatar: undefined,
      banner: undefined,
      description: 'A community',
      name: 'Builders',
    },
    publication: {
      autoJoinEnabled: false,
      discoverable: true,
      visibility: 'private',
    },
    roles: [
      {
        builtIn: false,
        id: 'member-role',
        name: 'Member',
        permissions: ['view_channels'],
      },
      {
        builtIn: true,
        id: 'everyone',
        name: 'Everyone',
        permissions: ['view_channels'],
      },
    ],
  });

export const communityRepositoryMock =
  (): jest.Mocked<CommunityRepository> => ({
    assignMemberRoles: jest.fn(),
    banMember: jest.fn(),
    createRole: jest.fn(),
    createTextChannel: jest.fn(),
    createVoiceChannel: jest.fn(),
    deleteChannel: jest.fn(),
    deleteRole: jest.fn(),
    find: jest.fn(),
    kickMember: jest.fn(),
    leave: jest.fn(),
    renameChannel: jest.fn(),
    restrictChannel: jest.fn(),
    search: jest.fn(),
    unbanMember: jest.fn(),
    updateProfile: jest.fn(),
    updateRole: jest.fn(),
  });
