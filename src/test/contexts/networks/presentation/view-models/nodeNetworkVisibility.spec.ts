import type { NodeNetwork } from '../../../../../contexts/networks/presentation/view-models/NodeNetwork';

import {
  allowedNetworkIds,
  selectNetworkId,
} from '../../../../../contexts/networks/presentation/view-models/nodeNetworkVisibility';

const ownerPrivate: NodeNetwork = {
  id: 'network-keyed',
  key: 'key-placeholder',
  name: 'Team',
  privateNetwork: true,
};
const privateNamedPublic: NodeNetwork = {
  id: 'network-named-public',
  name: 'public',
  privateNetwork: true,
};
const signedNonOwnerPrivate: NodeNetwork = {
  id: 'network-private-no-key',
  name: 'Team',
  privateNetwork: true,
};
const publicNetwork: NodeNetwork = {
  id: 'network-public',
  name: 'public',
  privateNetwork: false,
};
const publicWithKey: NodeNetwork = {
  id: 'network-public-keyed',
  key: 'key-placeholder',
  name: 'Team',
  privateNetwork: false,
};
const unflaggedKeyed: NodeNetwork = {
  id: 'network-unflagged',
  key: 'key-placeholder',
  name: 'Team',
};
const anonymousNetwork: NodeNetwork = { id: 'network-anonymous', name: 'Team' };

describe(allowedNetworkIds.name, () => {
  it('offers a network the node flags private, whatever its name', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-named-public', 'network-public'],
        nodeNetworks: [privateNamedPublic, publicNetwork],
        privateOnly: true,
      }),
    ).toEqual(['network-named-public']);
  });

  it('offers a private network to a signed non-owner that has the flag but no key', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-private-no-key'],
        nodeNetworks: [signedNonOwnerPrivate],
        privateOnly: true,
      }),
    ).toEqual(['network-private-no-key']);
  });

  it('offers the owner its keyed private network', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-keyed', 'network-public'],
        nodeNetworks: [ownerPrivate, publicNetwork],
        privateOnly: true,
      }),
    ).toEqual(['network-keyed']);
  });

  it('never offers a network the node flags public, even when a key is present', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-public-keyed'],
        nodeNetworks: [publicWithKey],
        privateOnly: true,
      }),
    ).toEqual([]);
  });

  it('never offers a network without the private flag, whatever its key', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-unflagged', 'network-public'],
        nodeNetworks: [unflaggedKeyed, publicNetwork],
        privateOnly: true,
      }),
    ).toEqual([]);
  });

  it('places nothing for an anonymous session where the node sends no flag', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-anonymous'],
        nodeNetworks: [anonymousNetwork],
        privateOnly: true,
      }),
    ).toEqual([]);
  });

  it('places nothing while the node list is empty or not loaded', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-keyed'],
        nodeNetworks: [],
        privateOnly: true,
      }),
    ).toEqual([]);
  });

  it('drops identity networks the node list does not describe', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-keyed', 'network-unknown'],
        nodeNetworks: [ownerPrivate],
        privateOnly: true,
      }),
    ).toEqual(['network-keyed']);
  });

  it('keeps every identity network for public communities', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-keyed', 'network-public'],
        nodeNetworks: [ownerPrivate, publicNetwork],
        privateOnly: false,
      }),
    ).toEqual(['network-keyed', 'network-public']);
  });
});

describe(selectNetworkId.name, () => {
  it('keeps the current network while it is still allowed', () => {
    expect(
      selectNetworkId('network-private', ['network-other', 'network-private']),
    ).toBe('network-private');
  });

  it('falls back to the first allowed network once the current one is not offered', () => {
    expect(selectNetworkId('network-public', ['network-private'])).toBe(
      'network-private',
    );
  });

  it('selects the first allowed network when nothing is selected yet', () => {
    expect(selectNetworkId('', ['network-private'])).toBe('network-private');
  });

  it('selects nothing when no network is allowed', () => {
    expect(selectNetworkId('network-public', [])).toBe('');
  });
});
