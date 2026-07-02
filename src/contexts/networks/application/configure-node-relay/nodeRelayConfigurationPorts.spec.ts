import { defaultNodeRelayConfiguration } from './defaultNodeRelayConfiguration';
import { nodeRelayConfigurationPorts } from './nodeRelayConfigurationPorts';

describe('nodeRelayConfigurationPorts', () => {
  it('should list enabled relay ports that can be checked', () => {
    const configuration = defaultNodeRelayConfiguration();

    configuration.publicHost = 'relay.example.com';
    configuration.callsRelay.port = 3478;
    configuration.publicRelay = {
      autoEnabled: false,
      discoveryEnabled: true,
      enabled: true,
      libp2pPort: 4001,
      port: 4011,
    };
    configuration.privateRelay = {
      enabled: true,
      portEnd: 4199,
      portStart: 4100,
      publicRecordDiscoveryEnabled: true,
      publicRecordPublicationEnabled: true,
    };

    expect(nodeRelayConfigurationPorts(configuration)).toEqual([
      expect.objectContaining({ id: 'callsRelayUdp', port: 3478 }),
      expect.objectContaining({ id: 'callsRelayTcp', port: 3478 }),
      expect.objectContaining({ id: 'publicRelay', port: 4011 }),
      expect.objectContaining({ id: 'publicRelayLibp2p', port: 4001 }),
      expect.objectContaining({ id: 'privateRelayStart', port: 4100 }),
      expect.objectContaining({ id: 'privateRelayEnd', port: 4199 }),
    ]);
  });

  it('should skip disabled relay sections', () => {
    const configuration = defaultNodeRelayConfiguration();

    configuration.callsRelay.port = 3478;

    expect(nodeRelayConfigurationPorts(configuration)).toEqual([
      expect.objectContaining({ id: 'callsRelayUdp' }),
      expect.objectContaining({ id: 'callsRelayTcp' }),
    ]);
  });
});
