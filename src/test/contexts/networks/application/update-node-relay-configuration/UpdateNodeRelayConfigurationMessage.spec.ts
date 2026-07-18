import { UpdateNodeRelayConfigurationMessage } from '../../../../../contexts/networks/application/update-node-relay-configuration/messages/UpdateNodeRelayConfigurationMessage';

describe(UpdateNodeRelayConfigurationMessage.name, () => {
  it('normalizes manual relay addresses before creating value objects', () => {
    const message = new UpdateNodeRelayConfigurationMessage({
      callsRelay: {},
      manualRelayMultiaddrs: [
        '  /dns4/relay.example.com/tcp/4100  ',
        '',
        '   ',
      ],
      privateRelay: {
        discoveryEnabled: true,
        enabled: false,
      },
      publicNetwork: { enabled: false },
    });

    expect(
      message
        .getManualRelayMultiaddresses()
        .map((multiaddress) => multiaddress.toString()),
    ).toEqual(['/dns4/relay.example.com/tcp/4100']);
  });
});
