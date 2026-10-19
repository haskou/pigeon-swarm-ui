import type { NodeNetwork } from '../../../../../contexts/networks/presentation/view-models/NodeNetwork';

import {
  allowedNetworkIds,
  isPublicNodeNetwork,
} from '../../../../../contexts/networks/presentation/view-models/nodeNetworkVisibility';

const publicNetwork: NodeNetwork = { id: 'network-public', name: 'public' };
const privateNetwork: NodeNetwork = {
  id: 'network-private',
  name: 'UI acceptance',
};
const nodeNetworks = [publicNetwork, privateNetwork];

describe(isPublicNodeNetwork.name, () => {
  it.each(['public', 'Public network', ' PUBLIC '])(
    'recognises %p as the public network',
    (name) => {
      expect(isPublicNodeNetwork({ id: 'network', name })).toBe(true);
    },
  );

  it('does not treat a named private network as public', () => {
    expect(isPublicNodeNetwork(privateNetwork)).toBe(false);
  });
});

describe(allowedNetworkIds.name, () => {
  it('keeps only private networks for direct conversations and private communities', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-public', 'network-private'],
        nodeNetworks,
        privateOnly: true,
      }),
    ).toEqual(['network-private']);
  });

  it('keeps public networks for public communities', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-public', 'network-private'],
        nodeNetworks,
        privateOnly: false,
      }),
    ).toEqual(['network-public', 'network-private']);
  });

  it('returns no network when only the public network is shared, so callers never fall back to it', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-public'],
        nodeNetworks,
        privateOnly: true,
      }),
    ).toEqual([]);
  });

  it('keeps identity networks that the node list does not describe', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-unknown'],
        nodeNetworks,
        privateOnly: true,
      }),
    ).toEqual(['network-unknown']);
  });
});
