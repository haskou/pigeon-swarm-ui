import type { CallResource } from '../../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallSession } from '../../../../../contexts/calls/presentation/view-models/CallSession';
import type { CommunityResource as Community } from '../../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { IdentityResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { LocalKeychain } from '../../../../../contexts/identities/infrastructure/keychain/LocalKeychain';

import { resolveWorkspaceCallDetails } from '../../../../../app/presentation/workspace/components/resolveWorkspaceCallDetails';

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
        status: 'joined',
      },
      {
        connected: true,
        identityId: 'identity-2',
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
    admissionNonce: '0',
    authorizationRevision: 0,
    deviceCredential: 'device-credential',
    deviceCredentialCommitment: 'device-credential-commitment',
    id,
    networks: ['network-1'],
    profile: { name },
    recoveryAuthority: 'recovery-authority',
    signature: '',
    timestamp: 1,
    version: 1,
  };
}

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
          status: 'joined',
        },
        {
          connected: false,
          identityId: 'identity-2',
          status: 'joined',
        },
        {
          connected: true,
          identityId: 'identity-3',
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

  it('resolves a group-capability call as a group call from its lease roster, naming no conversation', () => {
    const call = callResource({
      participantIds: [],
      participants: [
        { connected: true, identityId: 'identity-1', status: 'joined' },
        { connected: true, identityId: 'identity-2', status: 'joined' },
        { connected: false, identityId: 'identity-3', status: 'joined' },
      ],
      scope: { capabilityHash: 'a'.repeat(64), type: 'group_capability' },
    });

    expect(
      resolveWorkspaceCallDetails({
        call,
        communities: [],
        conversations: [],
        currentIdentity,
        fallbackLabels,
        identityNames: { 'identity-1': 'Hasko', 'identity-2': 'Den' },
        identityPictures: {},
        identityProfiles: {},
        keychain: emptyKeychain(),
      }),
    ).toEqual({
      kind: 'group' satisfies CallSession['kind'],
      participants: [
        expect.objectContaining({ identityId: 'identity-1' }),
        expect.objectContaining({ identityId: 'identity-2' }),
      ],
      subtitle: undefined,
      title: 'No conversation',
    });
  });
});
