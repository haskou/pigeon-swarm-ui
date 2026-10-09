import type { CallResource } from '../../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type {
  Community,
  LocalKeychain,
} from '../../../../../shared/domain/pigeonResources.types';

import { resolveWorkspaceCallMediaEncryption } from '../../../../../app/presentation/workspace/components/resolveWorkspaceCallMediaEncryption';

function community(visibility: Community['visibility']): Community {
  return {
    autoJoinEnabled: false,
    createdAt: 1,
    description: '',
    discoverable: true,
    id: 'community-1',
    memberIds: [],
    name: 'Community',
    networkId: 'network-1',
    ownerIdentityId: 'identity-1',
    textChannels: [],
    visibility,
    voiceChannels: [],
  };
}

function call(scope: CallResource['scope']): CallResource {
  return {
    createdAt: 1,
    creatorIdentityId: 'identity-1',
    id: 'call-1',
    networkId: 'network-1',
    participantIds: ['identity-1'],
    participants: [],
    scope,
    status: 'active',
  };
}

function communityCall(): CallResource {
  return call({
    channelId: 'voice-1',
    communityId: 'community-1',
    type: 'community_channel',
  });
}

function conversationCall(): CallResource {
  return call({ conversationId: 'conversation-1', type: 'conversation' });
}

function emptyKeychain(): LocalKeychain {
  return { conversations: {}, version: 2 };
}

describe('resolveWorkspaceCallMediaEncryption', () => {
  it('disables media encryption for public communities', async () => {
    await expect(
      resolveWorkspaceCallMediaEncryption({
        call: communityCall(),
        communities: [community('public')],
        communityCallKey: jest.fn(),
        currentIdentityId: 'identity-1',
        enabled: true,
        keychain: emptyKeychain(),
      }),
    ).resolves.toEqual({
      mediaEncryptionEnabled: true,
      mediaEncryptionUnavailableReason: 'public-community',
    });
  });

  it('derives private community keys from the group, scoped to the call', async () => {
    const communityCallKey = jest.fn().mockResolvedValue('derived-key');

    await expect(
      resolveWorkspaceCallMediaEncryption({
        call: communityCall(),
        communities: [community('private')],
        communityCallKey,
        currentIdentityId: 'identity-1',
        enabled: true,
        keychain: emptyKeychain(),
      }),
    ).resolves.toEqual({
      mediaEncryptionEnabled: true,
      mediaEncryptionKey: 'derived-key',
    });
    expect(communityCallKey).toHaveBeenCalledWith('community-1', 'call-1');
  });

  it('reports a missing key when this device is not in the group', async () => {
    await expect(
      resolveWorkspaceCallMediaEncryption({
        call: communityCall(),
        communities: [community('private')],
        communityCallKey: jest.fn().mockRejectedValue(new Error('no group')),
        currentIdentityId: 'identity-1',
        enabled: true,
        keychain: emptyKeychain(),
      }),
    ).resolves.toEqual({
      mediaEncryptionEnabled: true,
      mediaEncryptionUnavailableReason: 'missing-key',
    });
  });

  it('reports a missing conversation key', async () => {
    await expect(
      resolveWorkspaceCallMediaEncryption({
        call: conversationCall(),
        communities: [],
        communityCallKey: jest.fn(),
        currentIdentityId: 'identity-1',
        enabled: false,
        keychain: emptyKeychain(),
      }),
    ).resolves.toEqual({
      mediaEncryptionEnabled: false,
      mediaEncryptionUnavailableReason: 'missing-key',
    });
  });
});
