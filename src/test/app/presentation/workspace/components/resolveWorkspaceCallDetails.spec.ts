import type {
  CallResource,
  CallSession,
} from '../../../../../contexts/calls/domain/callSession.types';
import type {
  Community,
  IdentityResource,
  LocalKeychain,
} from '../../../../../shared/domain/pigeonResources.types';

import { resolveWorkspaceCallDetails } from '../../../../../app/presentation/workspace/components/resolveWorkspaceCallDetails';

const currentIdentity = identity('identity-1', 'Hasko');
const fallbackLabels = {
  noConversation: 'No conversation',
  privateCommunity: 'Private community',
  voiceChannel: 'Voice channel',
};

describe(resolveWorkspaceCallDetails.name, () => {
  it('uses live lease presence for community call participants', () => {
    const call = callResource({
      participantIds: ['identity-1', 'identity-2'],
      participants: [
        {
          connected: true,
          identityId: 'identity-1',
          mediaConnections: [],
          status: 'joined',
        },
        {
          connected: false,
          identityId: 'identity-2',
          mediaConnections: [],
          status: 'joined',
        },
        {
          connected: true,
          identityId: 'identity-3',
          mediaConnections: [],
          status: 'left',
        },
      ],
      scope: {
        channelId: 'voice-1',
        communityId: 'community-1',
        type: 'community_channel',
      },
    });

    expect(
      resolveWorkspaceCallDetails({
        call,
        communities: [community()],
        conversations: [],
        currentIdentity,
        fallbackLabels,
        identityNames: { 'identity-1': 'Hasko', 'identity-2': 'Den' },
        identityPictures: {},
        identityProfiles: {},
        keychain: emptyKeychain(),
      }),
    ).toMatchObject({
      channelId: 'voice-1',
      communityId: 'community-1',
      kind: 'community-voice' satisfies CallSession['kind'],
      participants: [
        {
          identityId: 'identity-1',
          name: 'Hasko',
          status: 'joined',
        },
        { identityId: 'identity-3', status: 'left' },
      ],
      subtitle: 'Schale',
      title: 'General voice',
    });
  });

  it('keeps group conversation titles', () => {
    const call = callResource({
      scope: { conversationId: 'conversation-1', type: 'conversation' },
    });

    expect(
      resolveWorkspaceCallDetails({
        call,
        communities: [],
        conversations: [
          {
            id: 'conversation-1',
            name: 'Study group',
            networkId: 'network-1',
            participantIdentityIds: ['identity-1', 'identity-2'],
            type: 'group',
          },
        ],
        currentIdentity,
        fallbackLabels,
        identityNames: { 'identity-1': 'Hasko', 'identity-2': 'Den' },
        identityPictures: {},
        identityProfiles: {},
        keychain: emptyKeychain(),
      }),
    ).toMatchObject({
      conversationId: 'conversation-1',
      kind: 'group' satisfies CallSession['kind'],
      title: 'Study group',
    });
  });
});

function callResource(overrides: Partial<CallResource> = {}): CallResource {
  return {
    createdAt: 1,
    creatorIdentityId: 'identity-1',
    id: 'call-1',
    networkId: 'network-1',
    participantIds: ['identity-1', 'identity-2'],
    participants: [
      {
        connected: true,
        identityId: 'identity-1',
        mediaConnections: [],
        status: 'joined',
      },
      {
        connected: true,
        identityId: 'identity-2',
        mediaConnections: [],
        status: 'joined',
      },
    ],
    scope: { conversationId: 'conversation-1', type: 'conversation' },
    status: 'active',
    ...overrides,
  };
}

function community(): Community {
  return {
    autoJoinEnabled: false,
    createdAt: 1,
    description: '',
    discoverable: true,
    id: 'community-1',
    memberIds: ['identity-1'],
    name: 'Schale',
    networkId: 'network-1',
    ownerIdentityId: 'identity-1',
    textChannels: [],
    visibility: 'private',
    voiceChannels: [
      {
        connectedIdentityIds: ['identity-1'],
        createdAt: 1,
        id: 'voice-1',
        name: 'General voice',
        type: 'voice',
      },
    ],
  };
}

function emptyKeychain(): LocalKeychain {
  return { conversations: {}, version: 1 };
}

function identity(id: string, name: string): IdentityResource {
  return {
    encryptedKeyPair: {
      encryptedPrivateKey: '',
      publicKey: '',
    },
    encryptedMasterKey: '',
    id,
    masterKeyDerivation: {
      algorithm: 'scrypt',
      N: 16_384,
      p: 5,
      r: 8,
      salt: '',
      version: 1,
    },
    networks: ['network-1'],
    profile: { name },
    signature: '',
    timestamp: 1,
    version: 1,
  };
}
