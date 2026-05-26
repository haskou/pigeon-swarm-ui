import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { RemoveNodeNetworkMessage } from './messages/RemoveNodeNetworkMessage';
import { RemoveNodeNetwork } from './RemoveNodeNetwork';

describe(RemoveNodeNetwork.name, () => {
  it('removes the node network anonymously', async () => {
    const expected = [{ id: 'public-network', name: 'public' }];
    const networks = {
      remove: jest.fn().mockResolvedValue(expected),
    };
    const useCase = new RemoveNodeNetwork(networks);

    await expect(
      useCase.remove(
        new RemoveNodeNetworkMessage({ networkId: 'public-network' }),
      ),
    ).resolves.toBe(expected);

    expect(networks.remove).toHaveBeenCalledWith(
      expect.objectContaining({}),
      undefined,
    );
  });

  it('removes the node network with owner session', async () => {
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const expected = [{ id: 'network-2', key: 'key', name: 'private' }];
    const networks = {
      remove: jest.fn().mockResolvedValue(expected),
    };
    const useCase = new RemoveNodeNetwork(networks);

    await expect(
      useCase.remove(
        new RemoveNodeNetworkMessage({ networkId: 'network-1', session }),
      ),
    ).resolves.toBe(expected);

    expect(networks.remove).toHaveBeenCalledWith(
      expect.objectContaining({}),
      session,
    );
  });
});
