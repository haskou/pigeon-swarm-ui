import type { CallResource } from '../../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type {
  Community,
  LocalKeychain,
} from '../../../../../shared/domain/pigeonResources.types';

import { resolveWorkspaceCallMediaEncryption } from '../../../../../app/presentation/workspace/components/resolveWorkspaceCallMediaEncryption';

describe('resolveWorkspaceCallMediaEncryption', () => {
  it('disables media encryption for public communities', () => {
    expect(
      resolveWorkspaceCallMediaEncryption({
        call: communityCall(),
        communities: [community('public')],
        currentIdentityId: 'identity-1',
        enabled: true,
        keychain: emptyKeychain(),
      }),
    ).toEqual({
      mediaEncryptionEnabled: true,
      mediaEncryptionUnavailableReason: 'public-community',
    });
  });

  it('uses the private community key', () => {
    expect(
      resolveWorkspaceCallMediaEncryption({
        call: communityCall(),
        communities: [community('private')],
        currentIdentityId: 'identity-1',
        enabled: true,
        keychain: keychainWith('community-1', 'community', 'secret-key'),
      }),
    ).toEqual({
      mediaEncryptionEnabled: true,
      mediaEncryptionKey: 'secret-key',
    });
  });

  it('reports a missing conversation key', () => {
    expect(
      resolveWorkspaceCallMediaEncryption({
        call: conversationCall(),
        communities: [],
        currentIdentityId: 'identity-1',
        enabled: false,
        keychain: emptyKeychain(),
      }),
    ).toEqual({
      mediaEncryptionEnabled: false,
      mediaEncryptionUnavailableReason: 'missing-key',
    });
  });
});

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

function emptyKeychain(): LocalKeychain {
  return { conversations: {}, version: 2 };
}

function keychainWith(
  id: string,
  kind: 'community' | 'conversation',
  key: string,
): LocalKeychain {
  return {
    conversations: {
      [id]: {
        algorithm: 'aes-256-gcm',
        conversationId: id,
        createdAt: 1,
        key,
        kind,
        peerIdentityId: '',
        version: 2,
      },
    },
    version: 2,
  };
}
