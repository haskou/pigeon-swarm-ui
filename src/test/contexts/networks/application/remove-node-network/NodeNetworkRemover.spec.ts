import { mock } from 'jest-mock-extended';

import type { NetworkRepository } from '../../../../../contexts/networks/domain/repositories/NetworkRepository';

import { RemoveNodeNetworkMessage } from '../../../../../contexts/networks/application/remove-node-network/messages/RemoveNodeNetworkMessage';
import { NodeNetworkRemover } from '../../../../../contexts/networks/application/remove-node-network/NodeNetworkRemover';
import { Network } from '../../../../../contexts/networks/domain/Network';

describe(NodeNetworkRemover.name, () => {
  it('removes and persists the network through the aggregate', async () => {
    const networkRepository = mock<NetworkRepository>();
    const network = Network.fromPrimitives({
      id: 'network-a',
      key: 'secret-key',
      name: 'Builders',
      status: 'attached',
    });

    networkRepository.find.mockResolvedValue(network);
    networkRepository.save.mockResolvedValue(network);
    await expect(
      new NodeNetworkRemover(networkRepository).remove(
        new RemoveNodeNetworkMessage({
          actorIdentityId: 'identity-a',
          networkId: 'network-a',
        }),
      ),
    ).resolves.toBe(network);
    expect(network.toPrimitives().status).toBe('removed');
    expect(networkRepository.save).toHaveBeenCalledWith(
      network,
      expect.objectContaining({}),
    );
    expect(networkRepository.search).not.toHaveBeenCalled();
  });
});
