import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { CreatePublicNetwork } from '../../../../../contexts/networks/application/create-public-network/CreatePublicNetwork';
import { CreatePublicNetworkMessage } from '../../../../../contexts/networks/application/create-public-network/messages/CreatePublicNetworkMessage';

describe(CreatePublicNetwork.name, () => {
  it('creates the node public network anonymously', async () => {
    const networks = {
      createPublic: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new CreatePublicNetwork(networks);

    await useCase.create(new CreatePublicNetworkMessage());

    expect(networks.createPublic).toHaveBeenCalledWith(undefined);
  });

  it('creates the node public network with owner session', async () => {
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const networks = {
      createPublic: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new CreatePublicNetwork(networks);

    await useCase.create(new CreatePublicNetworkMessage(session));

    expect(networks.createPublic).toHaveBeenCalledWith(session);
  });
});
