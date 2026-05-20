import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { PigeonApiGateway } from '../../../../app/composition/pigeonApiGateway';

import { ListNodeNetworks } from './listNodeNetworks';

describe(ListNodeNetworks.name, () => {
  it('loads node networks through the pigeon API gateway', async () => {
    const expected = [{ id: 'network-1', name: 'Public Swarm' }];
    const gateway = {
      getNodeNetworks: jest.fn().mockResolvedValue(expected),
    } as unknown as PigeonApiGateway;
    const useCase = new ListNodeNetworks(gateway);

    await expect(useCase.execute()).resolves.toBe(expected);
    expect(gateway.getNodeNetworks).toHaveBeenCalledWith(undefined);
  });

  it('loads node networks with the current identity session when available', async () => {
    const expected = [{ id: 'network-1', name: 'Public Swarm' }];
    const session = { identity: { id: 'identity-1' } } as unknown as Session;
    const gateway = {
      getNodeNetworks: jest.fn().mockResolvedValue(expected),
    } as unknown as PigeonApiGateway;
    const useCase = new ListNodeNetworks(gateway);

    await expect(useCase.execute(session)).resolves.toBe(expected);
    expect(gateway.getNodeNetworks).toHaveBeenCalledWith(session);
  });
});
