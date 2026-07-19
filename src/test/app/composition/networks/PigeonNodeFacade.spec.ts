import { mock, type MockProxy } from 'jest-mock-extended';

import type { NetworkNodeClaimer } from '../../../../contexts/networks/application/claim-network-node/NetworkNodeClaimer';
import type { PublicNetworkCreator } from '../../../../contexts/networks/application/create-public-network/PublicNetworkCreator';
import type { NodeRelayConfigurationFinder } from '../../../../contexts/networks/application/find-node-relay-configuration/NodeRelayConfigurationFinder';
import type { NodeRelayConfigurationUpdater } from '../../../../contexts/networks/application/update-node-relay-configuration/NodeRelayConfigurationUpdater';
import type { PigeonNodeApi } from '../../../../contexts/networks/infrastructure/http/PigeonNodeApi';
import type { NodeRelayConfigurationViewModelMapper } from '../../../../contexts/networks/presentation/view-models/NodeRelayConfigurationViewModelMapper';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { PigeonNodeFacade } from '../../../../app/composition/networks/PigeonNodeFacade';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityAccessContexts } from '../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { NodeRelayConfiguration } from '../../../../contexts/networks/domain/NodeRelayConfiguration';

describe(PigeonNodeFacade.name, () => {
  let identities: IdentityAccessContexts;
  let nodeClaimer: MockProxy<NetworkNodeClaimer>;
  let publicNetworkCreator: MockProxy<PublicNetworkCreator>;
  let relayFinder: MockProxy<NodeRelayConfigurationFinder>;
  let relayUpdater: MockProxy<NodeRelayConfigurationUpdater>;
  let relayMapper: MockProxy<NodeRelayConfigurationViewModelMapper>;
  let node: MockProxy<PigeonNodeApi>;
  let facade: PigeonNodeFacade;

  beforeEach(() => {
    identities = new IdentityAccessContexts();
    nodeClaimer = mock<NetworkNodeClaimer>();
    publicNetworkCreator = mock<PublicNetworkCreator>();
    relayFinder = mock<NodeRelayConfigurationFinder>();
    relayUpdater = mock<NodeRelayConfigurationUpdater>();
    relayMapper = mock<NodeRelayConfigurationViewModelMapper>();
    node = mock<PigeonNodeApi>();
    facade = new PigeonNodeFacade(
      identities,
      nodeClaimer,
      publicNetworkCreator,
      relayFinder,
      relayUpdater,
      relayMapper,
      node,
    );
  });

  it('registers the actor before finding relay configuration', async () => {
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;
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
    const viewModel = {
      callsRelay: {},
      manualRelayMultiaddrs: [],
      privateRelay: {
        discoveryEnabled: true,
        enabled: false,
        publicationEnabled: false,
      },
      publicNetwork: { enabled: false },
    };
    relayFinder.find.mockResolvedValue(configuration);
    relayMapper.fromAggregate.mockReturnValue(viewModel);

    await expect(facade.getRelayConfiguration(session)).resolves.toBe(
      viewModel,
    );
    expect(identities.find(IdentityId.fromString('identity-a')).session).toBe(
      session,
    );
    expect(relayFinder.find.mock.calls[0]?.[0].getActorId().toString()).toBe(
      'identity-a',
    );
  });

  it('includes the public node id when updating first-run relay settings', async () => {
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
    const viewModel = {
      callsRelay: {},
      manualRelayMultiaddrs: [],
      privateRelay: {
        discoveryEnabled: true,
        enabled: false,
        publicationEnabled: false,
      },
      publicNetwork: { enabled: false },
    };
    node.getInfo.mockResolvedValue({ id: 'node-a', owner: null });
    relayUpdater.update.mockResolvedValue(configuration);
    relayMapper.fromAggregate.mockReturnValue(viewModel);

    await expect(facade.updateRelayConfiguration(viewModel)).resolves.toBe(
      viewModel,
    );

    const message = relayUpdater.update.mock.calls[0]?.[0];
    expect(message?.getActorId().isAnonymous()).toBe(true);
    expect(message?.getNodeId().toString()).toBe('node-a');
  });
});
