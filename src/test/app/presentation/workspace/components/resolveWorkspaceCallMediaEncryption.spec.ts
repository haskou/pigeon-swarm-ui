import type { CallResource } from '../../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { LocalKeychain } from '../../../../../contexts/identities/infrastructure/keychain/LocalKeychain';

import { resolveWorkspaceCallMediaEncryption } from '../../../../../app/presentation/workspace/components/resolveWorkspaceCallMediaEncryption';
import { CallPeerConnections } from '../../../../../contexts/calls/infrastructure/media/CallPeerConnections';
import { CallMediaEncryptionUnavailableError } from '../../../../../contexts/calls/presentation/errors/CallMediaEncryptionUnavailableError';
import { CommunityOperation } from '../../../../../contexts/communities/domain/operations/CommunityOperation';
import { copy } from '../../../../../shared/presentation/i18n/copy';

/** The signed operations of a community its genesis made `visibility`. */
function operationsOf(
  visibility: string,
): jest.Mock<Promise<readonly CommunityOperation[]>, [string]> {
  return jest
    .fn<Promise<readonly CommunityOperation[]>, [string]>()
    .mockResolvedValue([
      CommunityOperation.fromPrimitives({
        action: CommunityOperation.GENESIS,
        args: {
          autoJoinEnabled: false,
          description: '',
          discoverable: true,
          name: 'Community',
          nonce: 'nonce-1',
          visibility,
        },
        authorIdentityId: 'identity-1',
        communityId: 'community-1',
        createdAt: 1,
        hash: 'genesis-hash',
        networkId: 'network-1',
        parents: [],
      }),
    ]);
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
        communityOperations: operationsOf('public'),
        communityCallKey: jest.fn(),
        currentIdentityId: 'identity-1',
        keychain: emptyKeychain(),
      }),
    ).resolves.toEqual({
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
        communityOperations: operationsOf('public'),
        communityCallKey: jest.fn(),
        currentIdentityId: 'identity-1',
        keychain: emptyKeychain(),
      }),
    ).resolves.toEqual({
      mediaEncryptionUnavailableReason: 'public-community',
    });
  });

  it("derives private community keys from the group of the call's channel, scoped to the call", async () => {
    const communityCallKey = jest.fn().mockResolvedValue('derived-key');

    await expect(
      resolveWorkspaceCallMediaEncryption({
        call: communityCall(),
        communityOperations: operationsOf('private'),
        communityCallKey,
        currentIdentityId: 'identity-1',
        keychain: emptyKeychain(),
      }),
    ).resolves.toEqual({ mediaEncryptionKey: 'derived-key' });
    expect(communityCallKey).toHaveBeenCalledWith(
      'community-1',
      'voice-1',
      'call-1',
    );
  });

  it('refuses a private community call when this device is not in the group', async () => {
    await expect(
      resolveWorkspaceCallMediaEncryption({
        call: communityCall(),
        communityOperations: operationsOf('private'),
        communityCallKey: jest.fn().mockRejectedValue(new Error('no group')),
        currentIdentityId: 'identity-1',
        keychain: emptyKeychain(),
      }),
    ).rejects.toThrow(new CallMediaEncryptionUnavailableError('missing-key'));
  });

  it('refuses a call in a community it does not know as public', async () => {
    const communityCallKey = jest.fn().mockRejectedValue(new Error('no group'));

    await expect(
      resolveWorkspaceCallMediaEncryption({
        call: communityCall(),
        communityOperations: jest.fn().mockResolvedValue([]),
        communityCallKey,
        currentIdentityId: 'identity-1',
        keychain: emptyKeychain(),
      }),
    ).rejects.toThrow(copy.calls.mediaEncryptionMissingKey);
    expect(communityCallKey).toHaveBeenCalledWith(
      'community-1',
      'voice-1',
      'call-1',
    );
  });

  it('encrypts a direct call with the conversation key', async () => {
    await expect(
      resolveWorkspaceCallMediaEncryption({
        call: conversationCall(),
        communityOperations: jest.fn().mockResolvedValue([]),
        communityCallKey: jest.fn(),
        currentIdentityId: 'identity-1',
        keychain: keychainWithConversationKey(),
      }),
    ).resolves.toEqual({ mediaEncryptionKey: 'conversation-key' });
  });

  it('refuses a direct call without a conversation key', async () => {
    await expect(
      resolveWorkspaceCallMediaEncryption({
        call: conversationCall(),
        communityOperations: jest.fn().mockResolvedValue([]),
        communityCallKey: jest.fn(),
        currentIdentityId: 'identity-1',
        keychain: emptyKeychain(),
      }),
    ).rejects.toThrow(copy.calls.mediaEncryptionMissingKey);
  });

  it('refuses a group-capability call, for which this device derives no media key', async () => {
    await expect(
      resolveWorkspaceCallMediaEncryption({
        call: call({
          capabilityHash: 'a'.repeat(64),
          type: 'group_capability',
        }),
        communityOperations: jest.fn().mockResolvedValue([]),
        communityCallKey: jest.fn(),
        currentIdentityId: 'identity-1',
        keychain: keychainWithConversationKey(),
      }),
    ).rejects.toThrow(new CallMediaEncryptionUnavailableError('missing-key'));
  });

  it('treats a community as private when its signed operations cannot be read', async () => {
    const communityCallKey = jest.fn().mockResolvedValue('derived-key');

    await expect(
      resolveWorkspaceCallMediaEncryption({
        call: communityCall(),
        communityOperations: jest.fn().mockRejectedValue(new Error('offline')),
        communityCallKey,
        currentIdentityId: 'identity-1',
        keychain: emptyKeychain(),
      }),
    ).resolves.toEqual({ mediaEncryptionKey: 'derived-key' });
  });

  it.each([
    ['a direct call', conversationCall()],
    ['a private community call', communityCall()],
  ])(
    'refuses %s in a browser that cannot encrypt media',
    async (_label, refusedCall) => {
      jest
        .spyOn(CallPeerConnections, 'mediaEncryptionSupported')
        .mockReturnValue(false);
      const communityCallKey = jest.fn().mockResolvedValue('derived-key');

      await expect(
        resolveWorkspaceCallMediaEncryption({
          call: refusedCall,
          communityOperations: operationsOf('private'),
          communityCallKey,
          currentIdentityId: 'identity-1',
          keychain: keychainWithConversationKey(),
        }),
      ).rejects.toThrow(copy.calls.mediaEncryptionUnsupported);
      expect(communityCallKey).not.toHaveBeenCalled();
    },
  );
});
