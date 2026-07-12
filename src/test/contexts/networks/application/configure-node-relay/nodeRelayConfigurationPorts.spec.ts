import { defaultNodeRelayConfiguration } from '../../../../../contexts/networks/application/configure-node-relay/defaultNodeRelayConfiguration';
import { nodeRelayConfigurationPorts } from '../../../../../contexts/networks/application/configure-node-relay/nodeRelayConfigurationPorts';

describe('nodeRelayConfigurationPorts', () => {
  it('should list enabled relay ports that can be checked', () => {
    const configuration = defaultNodeRelayConfiguration();

    configuration.callsRelay.port = 3478;
    configuration.publicNetwork = {
      enabled: true,
      port: 4011,
    };
    configuration.privateRelay = {
      discoveryEnabled: true,
      enabled: true,
      portEnd: 4199,
      portStart: 4100,
      publicationEnabled: true,
    };

    expect(nodeRelayConfigurationPorts(configuration)).toEqual([
      expect.objectContaining({ id: 'publicNetwork', port: 4011 }),
      expect.objectContaining({ id: 'callsRelayUdp', port: 3478 }),
      expect.objectContaining({ id: 'callsRelayTcp', port: 3478 }),
      expect.objectContaining({ id: 'privateRelayStart', port: 4100 }),
      expect.objectContaining({ id: 'privateRelayEnd', port: 4199 }),
    ]);
  });

  it('should skip disabled relay sections', () => {
    const configuration = defaultNodeRelayConfiguration();

    configuration.callsRelay.port = 3478;
    configuration.publicNetwork = {
      enabled: false,
      port: 4011,
    };

    expect(nodeRelayConfigurationPorts(configuration)).toEqual([
      expect.objectContaining({ id: 'publicNetwork' }),
      expect.objectContaining({ id: 'callsRelayUdp' }),
      expect.objectContaining({ id: 'callsRelayTcp' }),
    ]);
  });
});
