import { NetworkNodeMapper } from '../../../../../../contexts/networks/infrastructure/http/mapping/NetworkNodeMapper';

describe(NetworkNodeMapper.name, () => {
  it('maps ownership and public network availability into the aggregate', () => {
    const node = new NetworkNodeMapper().toAggregate({
      id: 'node-a',
      networkSummary: { privateCount: 2, publicCount: 1, total: 3 },
      owner: 'identity-a',
    });

    expect(node.toPrimitives()).toEqual({
      id: 'node-a',
      ownerId: 'identity-a',
      publicNetworkAttached: true,
    });
  });
});
