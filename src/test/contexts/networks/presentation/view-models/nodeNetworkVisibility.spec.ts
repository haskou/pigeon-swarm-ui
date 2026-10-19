import type { NodeNetwork } from '../../../../../contexts/networks/presentation/view-models/NodeNetwork';

import { allowedNetworkIds } from '../../../../../contexts/networks/presentation/view-models/nodeNetworkVisibility';

const keyedTeam: NodeNetwork = {
  id: 'network-keyed',
  key: 'key-placeholder',
  name: 'Team',
};
const unkeyedPublic: NodeNetwork = { id: 'network-public', name: 'public' };
const unkeyedTeam: NodeNetwork = { id: 'network-unkeyed', name: 'Team' };
const emptyKeyTeam: NodeNetwork = {
  id: 'network-empty-key',
  key: '',
  name: 'Team',
};
const nodeNetworks = [keyedTeam, unkeyedPublic];

describe(allowedNetworkIds.name, () => {
  it('offers a network whose node entry carries a non-empty key, whatever its name', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-keyed'],
        nodeNetworks,
        privateOnly: true,
      }),
    ).toEqual(['network-keyed']);
  });

  it('never offers a network named public that carries no key', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-public'],
        nodeNetworks,
        privateOnly: true,
      }),
    ).toEqual([]);
  });

  it('never offers a network without a key, whatever its name', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-unkeyed'],
        nodeNetworks: [unkeyedTeam],
        privateOnly: true,
      }),
    ).toEqual([]);
  });

  it('places nothing for an anonymous session where no network carries a key', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-unkeyed', 'network-public'],
        nodeNetworks: [unkeyedTeam, unkeyedPublic],
        privateOnly: true,
      }),
    ).toEqual([]);
  });

  it('treats an empty key as no key', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-empty-key'],
        nodeNetworks: [emptyKeyTeam],
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
        networkIds: ['network-unknown'],
        nodeNetworks,
        privateOnly: true,
      }),
    ).toEqual([]);
  });

  it('keeps every identity network for public communities', () => {
    expect(
      allowedNetworkIds({
        networkIds: ['network-public', 'network-keyed'],
        nodeNetworks,
        privateOnly: false,
      }),
    ).toEqual(['network-public', 'network-keyed']);
  });
});
