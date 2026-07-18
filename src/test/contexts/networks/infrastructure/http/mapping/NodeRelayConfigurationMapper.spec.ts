import { NodeRelayConfigurationMapper } from '../../../../../../contexts/networks/infrastructure/http/mapping/NodeRelayConfigurationMapper';

describe(NodeRelayConfigurationMapper.name, () => {
  it('maps API resources through the aggregate without leaking the node id back to HTTP', () => {
    const mapper = new NodeRelayConfigurationMapper();
    const resource = {
      callsRelay: { port: 3478 },
      manualRelayMultiaddrs: ['/dns4/relay.example.com/tcp/4100'],
      privateRelay: {
        discoveryEnabled: true,
        enabled: true,
        portEnd: 4172,
        portStart: 4172,
        publicationEnabled: true,
      },
      publicHost: 'relay.example.com',
      publicNetwork: { enabled: true, port: 4011 },
    };

    expect(mapper.toResource(mapper.toAggregate('node-a', resource))).toEqual(
      resource,
    );
  });
});
