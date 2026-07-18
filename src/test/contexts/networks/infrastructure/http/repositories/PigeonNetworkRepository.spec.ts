import { Timestamp } from '@haskou/value-objects';
import { mock, type MockProxy } from 'jest-mock-extended';

import type { PigeonNodeApi } from '../../../../../../contexts/networks/infrastructure/http/PigeonNodeApi';
import type { Session } from '../../../../../../shared/domain/pigeonResources.types';

import { IdentityAccessContexts } from '../../../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { Network } from '../../../../../../contexts/networks/domain/aggregates/Network';
import { NetworkNotFoundError } from '../../../../../../contexts/networks/domain/errors/NetworkNotFoundError';
import { NetworkActorId } from '../../../../../../contexts/networks/domain/value-objects/NetworkActorId';
import { NetworkId } from '../../../../../../contexts/networks/domain/value-objects/NetworkId';
import { NetworkName } from '../../../../../../contexts/networks/domain/value-objects/NetworkName';
import { NetworkMapper } from '../../../../../../contexts/networks/infrastructure/http/mapping/NetworkMapper';
import { PigeonNetworkRepository } from '../../../../../../contexts/networks/infrastructure/http/repositories/PigeonNetworkRepository';

describe(PigeonNetworkRepository.name, () => {
  let node: MockProxy<PigeonNodeApi>;
  let identities: IdentityAccessContexts;
  let repository: PigeonNetworkRepository;

  beforeEach(() => {
    node = mock<PigeonNodeApi>();
    identities = new IdentityAccessContexts();
    repository = new PigeonNetworkRepository(
      node,
      identities,
      new NetworkMapper(),
    );
  });

  it('creates a network anonymously and consumes its persisted event', async () => {
    const network = Network.create(
      NetworkName.fromString('Builders'),
      new Timestamp(100),
    );

    await repository.create(network, NetworkActorId.anonymous());

    expect(node.createNetwork).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        key: expect.any(String),
        name: 'Builders',
      }),
      undefined,
    );
    expect(network.pullDomainEvents()).toEqual([]);
  });

  it('uses the registered actor session for authenticated searches', async () => {
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;
    identities.register(session);
    node.getNetworks.mockResolvedValue([
      { id: 'network-a', key: 'private-key', name: 'Builders' },
    ]);

    const networks = await repository.search(
      NetworkActorId.fromOptional('identity-a'),
    );

    expect(node.getNetworks).toHaveBeenCalledWith(session);
    expect(networks[0]?.belongsTo(NetworkId.fromString('network-a'))).toBe(
      true,
    );
  });

  it('removes a network through the event recorded by the aggregate', async () => {
    const network = Network.fromPrimitives({
      id: 'network-a',
      key: 'private-key',
      name: 'Builders',
      status: 'attached',
    });
    network.remove(new Timestamp(100));

    await repository.save(network, NetworkActorId.anonymous());

    expect(node.removeNetwork).toHaveBeenCalledWith('network-a', undefined);
    expect(network.pullDomainEvents()).toEqual([]);
  });

  it('fails explicitly when a requested network is absent', async () => {
    node.getNetworks.mockResolvedValue([]);

    await expect(
      repository.find(
        NetworkId.fromString('missing-network'),
        NetworkActorId.anonymous(),
      ),
    ).rejects.toBeInstanceOf(NetworkNotFoundError);
  });
});
