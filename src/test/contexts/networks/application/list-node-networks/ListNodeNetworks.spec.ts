import type { ListNodeNetworksPort } from '../../../../../contexts/networks/application/list-node-networks/ListNodeNetworksPort';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { ListNodeNetworks } from '../../../../../contexts/networks/application/list-node-networks/ListNodeNetworks';
import { ListNodeNetworksMessage } from '../../../../../contexts/networks/application/list-node-networks/messages/ListNodeNetworksMessage';

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
