import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { ListNodeNetworksPort } from '../ports/listNodeNetworksPort';

import { ListNodeNetworks } from './listNodeNetworks';
import { ListNodeNetworksMessage } from './messages/listNodeNetworksMessage';

describe(ListNodeNetworks.name, () => {
  it('loads node networks through the pigeon API gateway', async () => {
    const expected = [{ id: 'network-1', name: 'Public Swarm' }];
    const gateway = {
      getNodeNetworks: jest.fn().mockResolvedValue(expected),
    } as unknown as ListNodeNetworksPort;
    const useCase = new ListNodeNetworks(gateway);

    await expect(useCase.list(new ListNodeNetworksMessage())).resolves.toBe(
      expected,
    );
    expect(gateway.getNodeNetworks).toHaveBeenCalledWith(undefined);
  });

  it('loads node networks with the current identity session when available', async () => {
    const expected = [{ id: 'network-1', name: 'Public Swarm' }];
    const session = { identity: { id: 'identity-1' } } as unknown as Session;
    const gateway = {
      getNodeNetworks: jest.fn().mockResolvedValue(expected),
    } as unknown as ListNodeNetworksPort;
    const useCase = new ListNodeNetworks(gateway);

    await expect(
      useCase.list(new ListNodeNetworksMessage(session)),
    ).resolves.toBe(expected);
    expect(gateway.getNodeNetworks).toHaveBeenCalledWith(session);
  });
});
