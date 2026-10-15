import type { CallResource } from '../../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CommunityResource as Community } from '../../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { LocalKeychain } from '../../../../../contexts/identities/infrastructure/keychain/LocalKeychain';

import { resolveWorkspaceCallMediaEncryption } from '../../../../../app/presentation/workspace/components/resolveWorkspaceCallMediaEncryption';
import { CallPeerConnections } from '../../../../../contexts/calls/infrastructure/media/CallPeerConnections';
import { CallMediaEncryptionUnavailableError } from '../../../../../contexts/calls/presentation/errors/CallMediaEncryptionUnavailableError';
import { copy } from '../../../../../shared/presentation/i18n/copy';

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

function keychainWithConversationKey(): LocalKeychain {
  return {
    conversations: {
      'conversation-1': {
        algorithm: 'aes-256-gcm',
        conversationId: 'conversation-1',
        createdAt: 1,
        key: 'conversation-key',
        kind: 'conversation',
        peerIdentityId: 'identity-2',
        version: 2,
      },
    },
    version: 2,
  };
}

describe('resolveWorkspaceCallMediaEncryption', () => {
  beforeEach(() => {
    jest
      .spyOn(CallPeerConnections, 'mediaEncryptionSupported')
      .mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it('keeps public community calls open to browsers that cannot encrypt media', async () => {
    jest
      .spyOn(CallPeerConnections, 'mediaEncryptionSupported')
      .mockReturnValue(false);

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

  it('refuses a private community call when this device is not in the group', async () => {
    await expect(
      resolveWorkspaceCallMediaEncryption({
        call: communityCall(),
        communities: [community('private')],
        communityCallKey: jest.fn().mockRejectedValue(new Error('no group')),
        currentIdentityId: 'identity-1',
        enabled: true,
        keychain: emptyKeychain(),
      }),
    ).rejects.toThrow(new CallMediaEncryptionUnavailableError('missing-key'));
  });

  it('refuses a call in a community it does not know as public', async () => {
    const communityCallKey = jest.fn().mockRejectedValue(new Error('no group'));

    await expect(
      resolveWorkspaceCallMediaEncryption({
        call: communityCall(),
        communities: [],
        communityCallKey,
        currentIdentityId: 'identity-1',
        enabled: true,
        keychain: emptyKeychain(),
      }),
    ).rejects.toThrow(copy.calls.mediaEncryptionMissingKey);
    expect(communityCallKey).toHaveBeenCalledWith('community-1', 'call-1');
  });

  it('encrypts a direct call with the conversation key', async () => {
    await expect(
      resolveWorkspaceCallMediaEncryption({
        call: conversationCall(),
        communities: [],
        communityCallKey: jest.fn(),
        currentIdentityId: 'identity-1',
        enabled: true,
        keychain: keychainWithConversationKey(),
      }),
    ).resolves.toEqual({
      mediaEncryptionEnabled: true,
      mediaEncryptionKey: 'conversation-key',
    });
  });

  it('refuses a direct call without a conversation key', async () => {
    await expect(
      resolveWorkspaceCallMediaEncryption({
        call: conversationCall(),
        communities: [],
        communityCallKey: jest.fn(),
        currentIdentityId: 'identity-1',
        enabled: false,
        keychain: emptyKeychain(),
      }),
    ).rejects.toThrow(copy.calls.mediaEncryptionMissingKey);
  });

  it.each([
    ['a direct call', conversationCall(), []],
    ['a private community call', communityCall(), [community('private')]],
  ])(
    'refuses %s in a browser that cannot encrypt media',
    async (_label, refusedCall, communities) => {
      jest
        .spyOn(CallPeerConnections, 'mediaEncryptionSupported')
        .mockReturnValue(false);
      const communityCallKey = jest.fn().mockResolvedValue('derived-key');

      await expect(
        resolveWorkspaceCallMediaEncryption({
          call: refusedCall,
          communities,
          communityCallKey,
          currentIdentityId: 'identity-1',
          enabled: true,
          keychain: keychainWithConversationKey(),
        }),
      ).rejects.toThrow(copy.calls.mediaEncryptionUnsupported);
      expect(communityCallKey).not.toHaveBeenCalled();
    },
  );
});
