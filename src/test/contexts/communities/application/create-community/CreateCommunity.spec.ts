import type { CreateCommunityPort } from '../../../../../contexts/communities/application/create-community/CreateCommunityPort';
import type { ManageCommunityChannelsPort } from '../../../../../contexts/communities/application/manage-community-channels/ManageCommunityChannelsPort';
import type { CommunityKeychainPort } from '../../../../../contexts/communities/application/publish-community-keychain/CommunityKeychainPort';
import type { CommunityMediaPort } from '../../../../../contexts/communities/application/upload-community-media/CommunityMediaPort';
import type {
  Community,
  LocalKeychain,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { CreateCommunity } from '../../../../../contexts/communities/application/create-community/CreateCommunity';
import { CreateCommunityMessage } from '../../../../../contexts/communities/application/create-community/messages/CreateCommunityMessage';

function session(keychain: LocalKeychain): Session {
  return {
    identity: { id: 'identity-1' },
    keychain,
    password: 'password',
  } as unknown as Session;
}

function community(visibility: 'private' | 'public'): Community {
  return {
    createdAt: 1,
    description: 'Community',
    id: 'community-1',
    memberIds: [],
    name: 'Community',
    networkId: 'network-1',
    ownerIdentityId: 'identity-1',
    textChannels: [],
    visibility,
  };
}

function keychain(): LocalKeychain {
  return { conversations: {}, version: 1 };
}

function createUseCase(
  overrides: {
    community?: Community;
    publishKeychain?: jest.Mock;
  } = {},
): {
  create: CreateCommunity;
  createCommunity: jest.Mocked<CreateCommunityPort>;
  keychain: jest.Mocked<CommunityKeychainPort>;
  channels: jest.Mocked<ManageCommunityChannelsPort>;
} {
  const createCommunity = {
    createCommunity: jest
      .fn()
      .mockResolvedValue(overrides.community ?? community('private')),
  } as jest.Mocked<CreateCommunityPort>;
  const channels = {
    createCommunityTextChannel: jest.fn().mockResolvedValue({
      createdAt: 1,
      id: 'channel-1',
      name: 'general',
      type: 'text',
    }),
    createCommunityVoiceChannel: jest.fn(),
  } as unknown as jest.Mocked<ManageCommunityChannelsPort>;
  const keychain = {
    publishKeychain:
      overrides.publishKeychain ??
      jest.fn().mockImplementation((_session, value) => ({
        keychain: value,
        keychainExternalIdentifier: 'keychain-1',
      })),
  } as jest.Mocked<CommunityKeychainPort>;
  const media = {
    uploadPublicFile: jest.fn(),
  } as jest.Mocked<CommunityMediaPort>;

  return {
    channels,
    create: new CreateCommunity(createCommunity, channels, keychain, media),
    createCommunity,
    keychain,
  };
}

describe(CreateCommunity.name, () => {
  it('publishes a community key and creates initial channels once for private communities', async () => {
    const useCase = createUseCase();
    const currentKeychain = keychain();

    const result = await useCase.create.create(
      new CreateCommunityMessage(session(currentKeychain), {
        channels: [{ name: 'general', type: 'text' }],
        description: 'Community',
        name: 'Community',
        networkId: 'network-1',
        visibility: 'private',
      }),
    );

    expect(useCase.keychain.publishKeychain).toHaveBeenCalledTimes(1);
    expect(useCase.channels.createCommunityTextChannel).toHaveBeenCalledTimes(
      1,
    );
    expect(result.keychain.conversations['community-1']).toMatchObject({
      conversationId: 'community-1',
      kind: 'community',
    });
  });

  it('does not publish a key for public communities', async () => {
    const useCase = createUseCase({ community: community('public') });

    const result = await useCase.create.create(
      new CreateCommunityMessage(session(keychain()), {
        description: 'Community',
        name: 'Community',
        networkId: 'network-1',
        visibility: 'public',
      }),
    );

    expect(useCase.keychain.publishKeychain).not.toHaveBeenCalled();
    expect(result.keychain).toEqual(keychain());
  });
});
