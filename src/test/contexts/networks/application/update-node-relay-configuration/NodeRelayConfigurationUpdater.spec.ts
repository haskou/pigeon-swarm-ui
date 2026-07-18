import { mock } from 'jest-mock-extended';

import type { NodeRelayConfigurationRepository } from '../../../../../contexts/networks/domain/repositories/NodeRelayConfigurationRepository';

import { UpdateNodeRelayConfigurationMessage } from '../../../../../contexts/networks/application/update-node-relay-configuration/messages/UpdateNodeRelayConfigurationMessage';
import { NodeRelayConfigurationUpdater } from '../../../../../contexts/networks/application/update-node-relay-configuration/NodeRelayConfigurationUpdater';
import { NodeRelayConfiguration } from '../../../../../contexts/networks/domain/aggregates/NodeRelayConfiguration';

describe(NodeRelayConfigurationUpdater.name, () => {
  it('changes the loaded aggregate before persisting it', async () => {
    const repository = mock<NodeRelayConfigurationRepository>();
    const configuration = NodeRelayConfiguration.fromPrimitives({
      callsRelay: { port: undefined },
      manualRelayMultiaddrs: [],
      nodeId: 'node-a',
      privateRelay: {
        discoveryEnabled: true,
        enabled: false,
        portEnd: undefined,
        portStart: undefined,
        publicationEnabled: false,
      },
      publicHost: undefined,
      publicNetwork: { enabled: false, port: undefined },
    });
    repository.find.mockResolvedValue(configuration);
    repository.save.mockImplementation((aggregate) =>
      Promise.resolve(aggregate),
    );

    const updated = await new NodeRelayConfigurationUpdater(repository).update(
      new UpdateNodeRelayConfigurationMessage({
        actorIdentityId: 'identity-a',
        callsRelay: { port: 3478 },
        manualRelayMultiaddrs: [],
        privateRelay: {
          discoveryEnabled: true,
          enabled: true,
          portEnd: 4172,
          portStart: 4172,
        },
        publicHost: 'relay.example.com',
        publicNetwork: { enabled: true, port: 4011 },
      }),
    );

    expect(updated).toBe(configuration);
    expect(updated.toPrimitives()).toMatchObject({
      callsRelay: { port: 3478 },
      privateRelay: { enabled: true, publicationEnabled: true },
      publicHost: 'relay.example.com',
      publicNetwork: { enabled: true, port: 4011 },
    });
    expect(repository.save.mock.calls[0]?.[0]).toBe(configuration);
    expect(repository.save.mock.calls[0]?.[1].toString()).toBe('identity-a');
  });
});
