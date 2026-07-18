import { Timestamp } from '@haskou/value-objects';
import { mock, type MockProxy } from 'jest-mock-extended';

import type { PigeonNodeApi } from '../../../../../../contexts/networks/infrastructure/http/PigeonNodeApi';
import type { Session } from '../../../../../../shared/domain/pigeonResources.types';

import { IdentityAccessContexts } from '../../../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { NetworkNode } from '../../../../../../contexts/networks/domain/aggregates/NetworkNode';
import { NetworkActorId } from '../../../../../../contexts/networks/domain/value-objects/NetworkActorId';
import { NetworkNodeOwnerId } from '../../../../../../contexts/networks/domain/value-objects/NetworkNodeOwnerId';
import { NetworkNodeMapper } from '../../../../../../contexts/networks/infrastructure/http/mapping/NetworkNodeMapper';
import { PigeonNetworkNodeRepository } from '../../../../../../contexts/networks/infrastructure/http/repositories/PigeonNetworkNodeRepository';

describe(PigeonNetworkNodeRepository.name, () => {
  let nodeApi: MockProxy<PigeonNodeApi>;
  let identities: IdentityAccessContexts;
  let repository: PigeonNetworkNodeRepository;

  beforeEach(() => {
    nodeApi = mock<PigeonNodeApi>();
    identities = new IdentityAccessContexts();
    repository = new PigeonNetworkNodeRepository(
      nodeApi,
      identities,
      new NetworkNodeMapper(),
    );
  });

  it('hydrates the local node from its API resource', async () => {
    nodeApi.getInfo.mockResolvedValue({
      id: 'node-a',
      networkSummary: { privateCount: 1, publicCount: 0, total: 1 },
      owner: null,
    });

    await expect(repository.find()).resolves.toEqual(
      expect.objectContaining({}),
    );
  });

  it('persists claim and public-network events through the actor session', async () => {
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;
    identities.register(session);
    const node = NetworkNode.fromPrimitives({
      id: 'node-a',
      ownerId: undefined,
      publicNetworkAttached: false,
    });
    node.claim(NetworkNodeOwnerId.fromString('identity-a'), new Timestamp(100));
    node.attachPublicNetwork(new Timestamp(200));

    await repository.save(node, NetworkActorId.fromOptional('identity-a'));

    expect(nodeApi.claim).toHaveBeenCalledWith(session);
    expect(nodeApi.createPublicNetwork).toHaveBeenCalledWith(session);
    expect(node.pullDomainEvents()).toEqual([]);
  });
});
