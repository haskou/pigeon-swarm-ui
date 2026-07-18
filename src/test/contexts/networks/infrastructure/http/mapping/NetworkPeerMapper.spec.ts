import { NetworkPeer } from '../../../../../../contexts/networks/domain/entities/NetworkPeer';
import { NetworkPeerMapper } from '../../../../../../contexts/networks/infrastructure/http/mapping/NetworkPeerMapper';

describe(NetworkPeerMapper.name, () => {
  it('maps API resources to domain peers and back', () => {
    const resource = {
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
      nodeType: 'reachable' as const,
      owner: 'identity-a',
    };
    const mapper = new NetworkPeerMapper();
    const peer = mapper.toAggregate(resource);

    expect(peer).toBeInstanceOf(NetworkPeer);
    expect(mapper.toResource(peer)).toEqual(resource);
  });
});
