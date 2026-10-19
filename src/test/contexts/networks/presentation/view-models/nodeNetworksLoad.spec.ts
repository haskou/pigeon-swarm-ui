import type { NodeNetwork } from '../../../../../contexts/networks/presentation/view-models/NodeNetwork';

import { loadNodeNetworkList } from '../../../../../contexts/networks/presentation/view-models/nodeNetworksLoad';

describe(loadNodeNetworkList.name, () => {
  it('returns the loaded list with no failure', async () => {
    const networks: NodeNetwork[] = [
      { id: 'network-keyed', key: 'key-placeholder', name: 'Team' },
    ];

    await expect(
      loadNodeNetworkList(() => Promise.resolve(networks)),
    ).resolves.toEqual({ failed: false, networks });
  });

  it('reports a failed load instead of returning an empty list silently', async () => {
    await expect(
      loadNodeNetworkList(() =>
        Promise.reject(new Error('network list unavailable')),
      ),
    ).resolves.toEqual({ failed: true, networks: [] });
  });
});
