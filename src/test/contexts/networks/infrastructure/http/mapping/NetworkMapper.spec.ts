import { Network } from '../../../../../../contexts/networks/domain/aggregates/Network';
import { NetworkMapper } from '../../../../../../contexts/networks/infrastructure/http/mapping/NetworkMapper';

describe(NetworkMapper.name, () => {
  const mapper = new NetworkMapper();

  it('hydrates an attached aggregate from an API resource', () => {
    const network = mapper.toAggregate({
      id: 'network-a',
      key: 'private-key',
      name: 'Builders',
    });

    expect(network).toBeInstanceOf(Network);
    expect(network.toPrimitives()).toEqual({
      id: 'network-a',
      key: 'private-key',
      name: 'Builders',
      status: 'attached',
    });
    expect(network.pullDomainEvents()).toEqual([]);
  });

  it('serializes an aggregate without leaking its lifecycle status', () => {
    const network = Network.fromPrimitives({
      id: 'network-a',
      key: undefined,
      name: 'Public network',
      status: 'attached',
    });

    expect(mapper.toResource(network)).toEqual({
      id: 'network-a',
      key: undefined,
      name: 'Public network',
    });
  });
});
