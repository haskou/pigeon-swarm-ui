import { mock } from 'jest-mock-extended';

import type { NetworkPeerRepository } from '../../../../../contexts/networks/domain/repositories/NetworkPeerRepository';

import { NetworkPeersSearcher } from '../../../../../contexts/networks/application/search-network-peers/NetworkPeersSearcher';
import { NetworkPeer } from '../../../../../contexts/networks/domain/entities/NetworkPeer';

describe(NetworkPeersSearcher.name, () => {
  it('returns domain peers from the repository', async () => {
    const repository = mock<NetworkPeerRepository>();
    const peer = NetworkPeer.fromPrimitives({
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
    });
    repository.search.mockResolvedValue([peer]);

    await expect(
      new NetworkPeersSearcher(repository).search(),
    ).resolves.toEqual([peer]);
  });
});
