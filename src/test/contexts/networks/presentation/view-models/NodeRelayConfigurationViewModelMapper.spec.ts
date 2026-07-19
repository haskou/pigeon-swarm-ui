import { NodeRelayConfiguration } from '../../../../../contexts/networks/domain/NodeRelayConfiguration';
import { NodeRelayConfigurationViewModelMapper } from '../../../../../contexts/networks/presentation/view-models/NodeRelayConfigurationViewModelMapper';

describe(NodeRelayConfigurationViewModelMapper.name, () => {
  it('removes the aggregate identity from the presentation model', () => {
    const configuration = NodeRelayConfiguration.fromPrimitives({
      callsRelay: { port: 3478 },
      manualRelayMultiaddrs: [],
      nodeId: 'node-a',
      privateRelay: {
        discoveryEnabled: true,
        enabled: false,
        portEnd: undefined,
        portStart: undefined,
        publicationEnabled: false,
      },
      publicHost: 'relay.example.com',
      publicNetwork: { enabled: false, port: undefined },
    });

    expect(
      new NodeRelayConfigurationViewModelMapper().fromAggregate(configuration),
    ).toEqual({
      callsRelay: { port: 3478 },
      manualRelayMultiaddrs: [],
      privateRelay: {
        discoveryEnabled: true,
        enabled: false,
        portEnd: undefined,
        portStart: undefined,
        publicationEnabled: false,
      },
      publicHost: 'relay.example.com',
      publicNetwork: { enabled: false, port: undefined },
    });
  });
});
