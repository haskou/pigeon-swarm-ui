import type { CommunityResource } from '../../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { CommunityId } from '../../../../../contexts/communities/domain/value-objects/CommunityId';
import { CommunityIdentityId } from '../../../../../contexts/communities/domain/value-objects/CommunityIdentityId';
import { CommunityAccessContexts } from '../../../../../contexts/communities/infrastructure/http/CommunityAccessContexts';
import { CommunityMapper } from '../../../../../contexts/communities/infrastructure/http/CommunityMapper';
import { PigeonCommunitiesGateway } from '../../../../../contexts/communities/infrastructure/http/PigeonCommunitiesGateway';
import { PigeonCommunityRepository } from '../../../../../contexts/communities/infrastructure/http/PigeonCommunityRepository';

const resource = (): CommunityResource => ({
  bannedMemberIds: [],
  createdAt: 100,
  description: 'A community',
  discoverable: true,
  id: 'community-a',
  memberIds: ['owner-a'],
  name: 'Builders',
  networkId: 'network-a',
  ownerIdentityId: 'owner-a',
  textChannels: [],
  visibility: 'private',
});

describe(PigeonCommunityRepository.name, () => {
  const actorIdentityId = CommunityIdentityId.fromString('owner-a');
  const session = { identity: { id: 'owner-a' } } as Session;

  const setup = () => {
    const contexts = new CommunityAccessContexts();
    const gateway = Object.create(
      PigeonCommunitiesGateway.prototype,
    ) as jest.Mocked<PigeonCommunitiesGateway>;

    contexts.register(session);

    return {
      gateway,
      repository: new PigeonCommunityRepository(
        gateway,
        contexts,
        new CommunityMapper(),
      ),
    };
  };

  it('hydrates a community returned by the HTTP gateway', async () => {
    const { gateway, repository } = setup();
    gateway.getCommunity = jest.fn().mockResolvedValue(resource());

    const community = await repository.find(
      CommunityId.fromString('community-a'),
      actorIdentityId,
    );

    expect(new CommunityMapper().toResource(community).id).toBe('community-a');
    expect(gateway.getCommunity).toHaveBeenCalledWith(session, 'community-a');
  });

  it('serializes aggregate profile state at the HTTP boundary', async () => {
    const { gateway, repository } = setup();
    const mapper = new CommunityMapper();
    const community = mapper.fromPrimitives(resource());
    gateway.updateCommunity = jest.fn().mockResolvedValue({
      ...resource(),
      name: 'Renamed',
    });

    await repository.updateProfile(community, actorIdentityId);

    expect(gateway.updateCommunity).toHaveBeenCalledWith(
      session,
      'community-a',
      expect.objectContaining({
        autoJoinEnabled: false,
        description: 'A community',
        discoverable: true,
        name: 'Builders',
      }),
    );
  });
});
