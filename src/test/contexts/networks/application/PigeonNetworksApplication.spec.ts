import type { NodeNetwork } from '../../../../contexts/networks/application/list-node-networks/NodeNetwork';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { PigeonNetworksApplication } from '../../../../contexts/networks/application/PigeonNetworksApplication';

describe(PigeonNetworksApplication.name, () => {
  type Dependencies = ConstructorParameters<
    typeof PigeonNetworksApplication
  >[0];

  function gatewayDouble(): jest.Mocked<Dependencies> {
    return {
      checkRelayPorts: { checkRelayPorts: jest.fn() },
      claimNode: { claim: jest.fn() },
      createNetwork: { create: jest.fn() },
      createNetworkForNode: { createNetwork: jest.fn() },
      createPublicNetwork: { createPublic: jest.fn() },
      getNodeInfo: { getInfo: jest.fn() },
      getRelayConfiguration: { getRelayConfiguration: jest.fn() },
      getReplicationStatus: { getIpfsReplicationStatus: jest.fn() },
      joinNetwork: { joinNetwork: jest.fn() },
      joinNetworkForNode: { joinNetwork: jest.fn() },
      listNodeNetworks: { getNodeNetworks: jest.fn() },
      listPeers: { getPeers: jest.fn() },
      removeNodeNetwork: { remove: jest.fn() },
      updateRelayConfiguration: { updateRelayConfiguration: jest.fn() },
    } as unknown as jest.Mocked<Dependencies>;
  }

  const session = {
    identity: { id: 'identity-1' },
  } as unknown as Session;

  it('creates anonymous networks through the domain use case', async () => {
    const gateway = gatewayDouble();
    const application = new PigeonNetworksApplication(gateway);

    await application.create('Development network');

    expect(gateway.createNetwork.create).toHaveBeenCalled();
  });

  it('keeps node-owned network creation explicitly authenticated', async () => {
    const gateway = gatewayDouble();
    const application = new PigeonNetworksApplication(gateway);

    await application.createForNode(session, 'Private network');

    expect(gateway.createNetworkForNode.createNetwork).toHaveBeenCalledWith(
      'Private network',
      session,
    );
  });

  it('lists networks through the list use case', async () => {
    const gateway = gatewayDouble();
    const networks = [
      { id: 'network-1', name: 'Development network' },
    ] as NodeNetwork[];
    (gateway.listNodeNetworks.getNodeNetworks as jest.Mock).mockResolvedValue(
      networks,
    );
    const application = new PigeonNetworksApplication(gateway);

    await expect(application.list(session)).resolves.toBe(networks);
    expect(gateway.listNodeNetworks.getNodeNetworks).toHaveBeenCalledWith(
      session,
    );
  });

  it('joins portable network credentials through validated messages', async () => {
    const gateway = gatewayDouble();
    const application = new PigeonNetworksApplication(gateway);

    await application.join('network-1', 'Private network', 'private-key');

    expect(gateway.joinNetwork.joinNetwork).toHaveBeenCalled();
  });
});
