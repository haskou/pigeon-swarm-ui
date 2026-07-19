import { mock } from 'jest-mock-extended';

import type { NodeRelayConfigurationRepository } from '../../../../../contexts/networks/domain/repositories/NodeRelayConfigurationRepository';

import { FindNodeRelayConfigurationMessage } from '../../../../../contexts/networks/application/find-node-relay-configuration/messages/FindNodeRelayConfigurationMessage';
import { NodeRelayConfigurationFinder } from '../../../../../contexts/networks/application/find-node-relay-configuration/NodeRelayConfigurationFinder';
import { NodeRelayConfiguration } from '../../../../../contexts/networks/domain/NodeRelayConfiguration';

describe(NodeRelayConfigurationFinder.name, () => {
  it('finds the aggregate for the actor represented by the message', async () => {
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

    await expect(
      new NodeRelayConfigurationFinder(repository).find(
        new FindNodeRelayConfigurationMessage('identity-a'),
      ),
    ).resolves.toBe(configuration);
    expect(repository.find.mock.calls[0]?.[0].toString()).toBe('identity-a');
  });
});
