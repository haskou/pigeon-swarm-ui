import { mock } from 'jest-mock-extended';

import type { NetworkRepository } from '../../../../../contexts/networks/domain/repositories/NetworkRepository';

import { RemoveNodeNetworkMessage } from '../../../../../contexts/networks/application/remove-node-network/messages/RemoveNodeNetworkMessage';
import { RemoveNodeNetwork } from '../../../../../contexts/networks/application/remove-node-network/RemoveNodeNetwork';
import { Network } from '../../../../../contexts/networks/domain/aggregates/Network';

describe(RemoveNodeNetwork.name, () => {
  it('removes through the aggregate and returns the remaining networks', async () => {
    const networkRepository = mock<NetworkRepository>();
    const network = Network.fromPrimitives({
      id: 'network-a',
      key: 'secret-key',
      name: 'Builders',
      status: 'attached',
    });

    networkRepository.find.mockResolvedValue(network);
    networkRepository.save.mockResolvedValue(network);
    networkRepository.search.mockResolvedValue([]);

    await expect(
      new RemoveNodeNetwork(networkRepository).remove(
        new RemoveNodeNetworkMessage({
          actorIdentityId: 'identity-a',
          networkId: 'network-a',
        }),
      ),
    ).resolves.toEqual([]);
    expect(network.toPrimitives().status).toBe('removed');
    expect(networkRepository.save).toHaveBeenCalledWith(
      network,
      expect.objectContaining({}),
    );
  });
});
