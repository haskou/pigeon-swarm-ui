import type { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

import { ListNodeNetworks } from './ListNodeNetworks';

describe(ListNodeNetworks.name, () => {
  it('loads node networks through the pigeon API gateway', async () => {
    const expected = [{ id: 'network-1', name: 'Public Swarm' }];
    const gateway = {
      getNodeNetworks: jest.fn().mockResolvedValue(expected),
    } as unknown as PigeonApiGateway;
    const useCase = new ListNodeNetworks(gateway);

    await expect(useCase.execute()).resolves.toBe(expected);
    expect(gateway.getNodeNetworks).toHaveBeenCalledTimes(1);
  });
});
