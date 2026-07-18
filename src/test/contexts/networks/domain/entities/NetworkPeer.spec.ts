import { NetworkPeer } from '../../../../../contexts/networks/domain/entities/NetworkPeer';
import { NetworkId } from '../../../../../contexts/networks/domain/value-objects/NetworkId';
import { NetworkPeerId } from '../../../../../contexts/networks/domain/value-objects/NetworkPeerId';

describe(NetworkPeer.name, () => {
  const primitives = {
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

  it('hydrates a peer while preserving its diagnostic state', () => {
    const peer = NetworkPeer.fromPrimitives(primitives);

    expect(peer.toPrimitives()).toEqual(primitives);
    expect(peer.belongsTo(NetworkPeerId.fromString('peer-a'))).toBe(true);
    expect(peer.sharesNetwork(NetworkId.fromString('network-a'))).toBe(true);
  });

  it('rejects malformed peer node types', () => {
    expect(() =>
      NetworkPeer.fromPrimitives({
        ...primitives,
        nodeType: 'mystery' as never,
      }),
    ).toThrow();
  });
});
