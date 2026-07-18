import { mock } from 'jest-mock-extended';

import type { NetworkRepository } from '../../../../../contexts/networks/domain/repositories/NetworkRepository';

import { SearchNodeNetworksMessage } from '../../../../../contexts/networks/application/search-node-networks/messages/SearchNodeNetworksMessage';
import { NodeNetworksSearcher } from '../../../../../contexts/networks/application/search-node-networks/NodeNetworksSearcher';

describe(NodeNetworksSearcher.name, () => {
  it('searches networks using an anonymous actor by default', async () => {
    const networkRepository = mock<NetworkRepository>();

    networkRepository.search.mockResolvedValue([]);

    await expect(
      new NodeNetworksSearcher(networkRepository).search(
        new SearchNodeNetworksMessage(),
      ),
    ).resolves.toEqual([]);
    expect(networkRepository.search.mock.calls[0][0].isAnonymous()).toBe(true);
  });

  it('searches networks using the authenticated identity', async () => {
    const networkRepository = mock<NetworkRepository>();

    networkRepository.search.mockResolvedValue([]);

    await new NodeNetworksSearcher(networkRepository).search(
      new SearchNodeNetworksMessage('identity-a'),
    );

    expect(networkRepository.search.mock.calls[0][0].toString()).toBe(
      'identity-a',
    );
  });
});
