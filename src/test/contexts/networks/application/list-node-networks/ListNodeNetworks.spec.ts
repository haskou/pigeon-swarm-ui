import { mock } from 'jest-mock-extended';

import type { NetworkRepository } from '../../../../../contexts/networks/domain/repositories/NetworkRepository';

import { ListNodeNetworks } from '../../../../../contexts/networks/application/list-node-networks/ListNodeNetworks';
import { ListNodeNetworksMessage } from '../../../../../contexts/networks/application/list-node-networks/messages/ListNodeNetworksMessage';

describe(ListNodeNetworks.name, () => {
  it('searches networks using an anonymous actor by default', async () => {
    const networkRepository = mock<NetworkRepository>();

    networkRepository.search.mockResolvedValue([]);

    await expect(
      new ListNodeNetworks(networkRepository).list(
        new ListNodeNetworksMessage(),
      ),
    ).resolves.toEqual([]);
    expect(networkRepository.search.mock.calls[0][0].isAnonymous()).toBe(true);
  });

  it('searches networks using the authenticated identity', async () => {
    const networkRepository = mock<NetworkRepository>();

    networkRepository.search.mockResolvedValue([]);

    await new ListNodeNetworks(networkRepository).list(
      new ListNodeNetworksMessage('identity-a'),
    );

    expect(networkRepository.search.mock.calls[0][0].toString()).toBe(
      'identity-a',
    );
  });
});
