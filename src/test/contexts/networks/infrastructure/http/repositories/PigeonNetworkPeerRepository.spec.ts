import { mock } from 'jest-mock-extended';

import type { PigeonNodeApi } from '../../../../../../contexts/networks/infrastructure/http/PigeonNodeApi';

import { NetworkPeerMapper } from '../../../../../../contexts/networks/infrastructure/http/mapping/NetworkPeerMapper';
import { PigeonNetworkPeerRepository } from '../../../../../../contexts/networks/infrastructure/http/repositories/PigeonNetworkPeerRepository';

describe(PigeonNetworkPeerRepository.name, () => {
  it('maps every peer returned by the node API', async () => {
    const node = mock<PigeonNodeApi>();
    node.getPeers.mockResolvedValue([
      {
        capabilities: {
          gossipsub: true,
          privateIpfs: true,
          publicIpfs: false,
          relay: false,
        },
        connectionSummary: {
          isSharedNetworkPeer: true,
          sharedNetworkCount: 1,
        },
        id: 'peer-a',
        lastSeenAt: 100,
        networks: [{ id: 'network-a', name: 'Builders' }],
        nodeType: 'reachable',
        owner: 'identity-a',
      },
    ]);

    const peers = await new PigeonNetworkPeerRepository(
      node,
      new NetworkPeerMapper(),
    ).search();

    expect(peers[0]?.toPrimitives().id).toBe('peer-a');
  });
});
