import type { NodeNetwork } from '../../../../contexts/networks/application/list-node-networks/NodeNetwork';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { PigeonNetworksApplication } from '../../../../contexts/networks/application/PigeonNetworksApplication';

describe(PigeonNetworksApplication.name, () => {
  type Dependencies = ConstructorParameters<
    typeof PigeonNetworksApplication
  >[0];

  function gatewayDouble(): jest.Mocked<Dependencies> {
    return {
      createNetwork: jest.fn(),
      getNetworks: jest.fn(),
      joinNetwork: jest.fn(),
      removeNetwork: jest.fn(),
    } as unknown as jest.Mocked<Dependencies>;
  }

  const session = {
    identity: { id: 'identity-1' },
  } as unknown as Session;

  it('creates anonymous networks through the domain use case', async () => {
    const gateway = gatewayDouble();
    const application = new PigeonNetworksApplication(gateway);

    await application.create('Development network');

    expect(gateway.createNetwork).toHaveBeenCalledWith('Development network');
  });

  it('keeps node-owned network creation explicitly authenticated', async () => {
    const gateway = gatewayDouble();
    const application = new PigeonNetworksApplication(gateway);

    await application.createForNode(session, 'Private network');

    expect(gateway.createNetwork).toHaveBeenCalledWith(
      'Private network',
      session,
    );
  });

  it('lists networks through the list use case', async () => {
    const gateway = gatewayDouble();
    const networks = [
      { id: 'network-1', name: 'Development network' },
    ] as NodeNetwork[];
    gateway.getNetworks.mockResolvedValue(networks);
    const application = new PigeonNetworksApplication(gateway);

    await expect(application.list(session)).resolves.toBe(networks);
    expect(gateway.getNetworks).toHaveBeenCalledWith(session);
  });

  it('joins portable network credentials through validated messages', async () => {
    const gateway = gatewayDouble();
    const application = new PigeonNetworksApplication(gateway);

    await application.join('network-1', 'Private network', 'private-key');

    expect(gateway.joinNetwork).toHaveBeenCalledWith(
      'network-1',
      'Private network',
      'private-key',
    );
  });
});
