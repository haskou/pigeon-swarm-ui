import type {
  Community,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { CreateCommunity } from '../../../../app/composition/communities/create-community/CreateCommunity';
import { LeaveCommunity } from '../../../../app/composition/communities/leave-community/LeaveCommunity';
import { PigeonCommunitiesGateway } from '../../../../contexts/communities/infrastructure/http/PigeonCommunitiesGateway';
import { PigeonIdentitiesGateway } from '../../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';

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

function communitiesGateway(): jest.Mocked<PigeonCommunitiesGateway> {
  const gateway = Object.create(
    PigeonCommunitiesGateway.prototype,
  ) as jest.Mocked<PigeonCommunitiesGateway>;

  gateway.createCommunity = jest.fn().mockResolvedValue(community());
  gateway.createCommunityTextChannel = jest.fn();
  gateway.createCommunityVoiceChannel = jest.fn();
  gateway.leaveCommunity = jest.fn();
  gateway.uploadPublicFile = jest.fn();

  return gateway;
}

function identitiesGateway(): jest.Mocked<PigeonIdentitiesGateway> {
  const gateway = Object.create(
    PigeonIdentitiesGateway.prototype,
  ) as jest.Mocked<PigeonIdentitiesGateway>;

  gateway.publishKeychain = jest
    .fn()
    .mockImplementation((_session, nextKeychain: LocalKeychain) =>
      Promise.resolve({
        keychain: nextKeychain,
        keychainExternalIdentifier: 'keychain-external-id',
      }),
    );

  return gateway;
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
    identity: { id: 'identity-1' },
    keychain: keychain(),
    password: 'password',
  } as unknown as Session;
}

describe('community lifecycle workflows', () => {
  it('creates private communities and publishes their symmetric key', async () => {
    const communities = communitiesGateway();
    const identities = identitiesGateway();

    const result = await new CreateCommunity(communities, identities).create(
      session(),
      {
        channels: [],
        description: 'Community',
        name: 'Community',
        networkId: 'network-1',
        visibility: 'private',
      },
    );

    expect(identities.publishKeychain).toHaveBeenCalledTimes(1);
    expect(result.keychain.conversations['community-1']).toMatchObject({
      kind: 'community',
      version: 2,
    });
  });

  it('removes the community key after leaving', async () => {
    const communities = communitiesGateway();
    const identities = identitiesGateway();
    communities.leaveCommunity.mockResolvedValue(community());

    const result = await new LeaveCommunity(communities, identities).leave(
      session(),
      'community-1',
    );

    expect(result.keychain.conversations).toEqual({});
  });

  it('cleans the key when remote membership was already absent', async () => {
    const communities = communitiesGateway();
    const identities = identitiesGateway();
    communities.leaveCommunity.mockRejectedValue(
      new HttpJsonError(
        409,
        'Conflict',
        JSON.stringify({ code: 'CommunityMemberNotFoundError' }),
      ),
    );

    const result = await new LeaveCommunity(communities, identities).leave(
      session(),
      'community-1',
    );

    expect(result.community).toBeNull();
    expect(result.keychain.conversations).toEqual({});
  });
});
