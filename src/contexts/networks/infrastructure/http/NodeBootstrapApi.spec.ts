import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { Peer } from '../../application/list-peers/ListPeers';

import { NodeBootstrapApi } from './NodeBootstrapApi';

describe(NodeBootstrapApi.name, () => {
  it('loads node info fresh because ownership changes after claiming', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'node-1',
        owner: undefined,
      })
      .mockResolvedValueOnce({
        id: 'node-1',
        owner: 'identity-1',
      });
    const api = new NodeBootstrapApi({
      request,
    } as unknown as HttpJsonClient);

    await expect(api.getInfo()).resolves.toEqual({
      id: 'node-1',
      owner: null,
    });
    await expect(api.getInfo()).resolves.toEqual({
      id: 'node-1',
      owner: 'identity-1',
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(1, '/node/');
    expect(request).toHaveBeenNthCalledWith(2, '/node/');
  });

  it('loads peers fresh because peer visibility changes over time', async () => {
    const peer: Peer = {
      capabilities: {
        gossipsub: true,
        privateIpfs: true,
        publicIpfs: false,
        relay: false,
      },
      connectionSummary: {
        isSharedNetworkPeer: true,
        sharedNetworkCount: 1,
      },
      id: '6e491cb3-8c70-4262-b25a-723dd8fa03cd',
      lastSeenAt: 1780944300024,
      networks: [
        {
          id: 'ee33cc83-2cf1-40c0-968c-1aae69e38ae7',
          name: 'Alpha network',
        },
      ],
      nodeType: 'unknown',
      owner: 'MCowBQYDK2VwAyEAbeVjQTYZphL/OY5i6+sXvl6h/DC0GLqa1H1hQD+ctbI=',
    };
    const request = jest
      .fn()
      .mockResolvedValueOnce({ peers: [] })
      .mockResolvedValueOnce({ peers: [peer] });
    const api = new NodeBootstrapApi({
      request,
    } as unknown as HttpJsonClient);

    await expect(api.getPeers()).resolves.toEqual([]);
    await expect(api.getPeers()).resolves.toEqual([peer]);

    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(1, '/peers/');
    expect(request).toHaveBeenNthCalledWith(2, '/peers/');
  });
});
