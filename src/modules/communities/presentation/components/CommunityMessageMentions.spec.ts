import type {
  Community,
  CommunityChannel,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';

import { CommunityMessageMentions } from './CommunityMessageMentions';

const channel: CommunityChannel = {
  createdAt: 100,
  id: 'channel-a',
  name: 'general',
  type: 'text',
};

const community = (overrides: Partial<Community> = {}): Community => ({
  createdAt: 100,
  description: 'A community',
  id: 'community-a',
  memberIds: ['owner-a', 'member-a'],
  name: 'Builders',
  networkId: 'network-a',
  ownerIdentityId: 'owner-a',
  roles: [
    {
      id: 'everyone',
      name: 'everyone',
      permissions: ['view_channels'],
      builtIn: true,
    },
    {
      id: 'role-a',
      name: 'Ops',
      permissions: ['view_channels'],
    },
  ],
  textChannels: [channel],
  visibility: 'private',
  ...overrides,
});

const identities: Record<string, IdentityResource> = {
  'member-a': {
    encryptedKeyPair: {
      encryptedPrivateKey: 'encrypted-private-key',
      publicKey: 'public-key',
    },
    id: 'member-a',
    networks: [],
    profile: {
      handle: 'hasko',
      name: 'Hasko',
    },
    signature: 'signature',
    timestamp: 100,
    version: 1,
  },
};

describe(CommunityMessageMentions.name, () => {
  it('builds unique mentions for everyone, here, roles, and identities', () => {
    expect(
      CommunityMessageMentions.forContent({
        channel,
        community: community(),
        content: '@everyone @here @Ops @hasko @Hasko',
        identities,
        permissions: new Set([
          'mention_everyone',
          'mention_here',
          'mention_roles',
          'view_channels',
        ]),
      }),
    ).toEqual([
      { type: 'everyone' },
      { type: 'here' },
      { targetId: 'role-a', type: 'role' },
      { targetId: 'member-a', type: 'identity' },
    ]);
  });

  it('exposes composer tokens only for allowed mention capabilities', () => {
    expect(
      CommunityMessageMentions.tokens({
        channel,
        community: community(),
        identities,
        permissions: new Set(['mention_roles', 'view_channels']),
      }),
    ).toEqual(['@Ops', '@owner-a', '@hasko', '@Hasko (@hasko)']);
  });
});
