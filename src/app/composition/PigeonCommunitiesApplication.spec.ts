import type {
  Community,
  LocalKeychain,
  Session,
} from '../../shared/domain/pigeonResources.types';

import { HttpJsonError } from '../../shared/infrastructure/http/HttpJsonError';
import { PigeonApiGateway } from './PigeonApiGateway';
import { PigeonCommunitiesApplication } from './PigeonCommunitiesApplication';

function gatewayDouble(overrides: {
  leaveCommunity: jest.Mock<Promise<Community>, [Session, string]>;
}): PigeonApiGateway & {
  publishKeychain: jest.Mock<
    Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }>,
    [Session, LocalKeychain]
  >;
} {
  const publishKeychain = jest
    .fn<
      Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }>,
      [Session, LocalKeychain]
    >()
    .mockImplementation((_session, keychain) =>
      Promise.resolve({
        keychain,
        keychainExternalIdentifier: 'keychain-external-id',
      }),
    );

  return {
    ...overrides,
    publishKeychain,
  } as unknown as PigeonApiGateway & {
    publishKeychain: typeof publishKeychain;
  };
}

function keychain(): LocalKeychain {
  return {
    conversations: {
      'external-key-id': {
        algorithm: 'aes-256-gcm',
        conversationId: 'community-1',
        createdAt: 1,
        key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        kind: 'community',
        peerIdentityId: '',
        version: 2,
      },
    },
    version: 1,
  };
}

function session(): Session {
  return {
    identity: {
      encryptedKeyPair: {
        encryptedPrivateKey: 'encrypted-private-key',
        publicKey: 'public-key',
      },
      encryptedMasterKey: 'encrypted-master-key',
      id: 'identity-1',
      masterKeyDerivation: {
        algorithm: 'scrypt',
        N: 16_384,
        p: 1,
        r: 8,
        salt: 'salt',
        version: 1,
      },
      networks: [],
      profile: { name: 'Identity' },
      signature: 'signature',
      timestamp: 1,
      version: 1,
    },
    keychain: keychain(),
    password: 'password',
  } as unknown as Session;
}

function community(): Community {
  return {
    createdAt: 1,
    description: 'Community',
    id: 'community-1',
    memberIds: [],
    name: 'Community',
    networkId: 'network-1',
    ownerIdentityId: 'identity-1',
    textChannels: [],
    visibility: 'private',
  };
}

function httpJsonError(code: string): HttpJsonError {
  return new HttpJsonError(409, 'Conflict', JSON.stringify({ code }));
}

describe(PigeonCommunitiesApplication.name, () => {
  it('publishes a keychain without the community key when leaving', async () => {
    const gateway = gatewayDouble({
      leaveCommunity: jest
        .fn<Promise<Community>, [Session, string]>()
        .mockResolvedValue(community()),
    });
    const application = new PigeonCommunitiesApplication(gateway);

    const result = await application.leave(session(), 'community-1');

    expect(gateway.publishKeychain).toHaveBeenCalledWith(session(), {
      conversations: {},
      version: 1,
    });
    expect(result).toMatchObject({
      communityId: 'community-1',
      keychain: { conversations: {}, version: 1 },
      keychainExternalIdentifier: 'keychain-external-id',
    });
  });

  it('still publishes the cleaned keychain when the leave was already applied', async () => {
    const gateway = gatewayDouble({
      leaveCommunity: jest
        .fn<Promise<Community>, [Session, string]>()
        .mockRejectedValue(httpJsonError('CommunityMemberNotFoundError')),
    });
    const application = new PigeonCommunitiesApplication(gateway);

    const result = await application.leave(session(), 'community-1');

    expect(gateway.publishKeychain).toHaveBeenCalledWith(session(), {
      conversations: {},
      version: 1,
    });
    expect(result.community).toBeNull();
  });
});
