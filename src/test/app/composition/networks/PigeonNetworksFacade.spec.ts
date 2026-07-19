import { mock, type MockProxy } from 'jest-mock-extended';

import type { NetworkCreator } from '../../../../contexts/networks/application/create-network/NetworkCreator';
import type { NetworkJoiner } from '../../../../contexts/networks/application/join-network/NetworkJoiner';
import type { NodeNetworkRemover } from '../../../../contexts/networks/application/remove-node-network/NodeNetworkRemover';
import type { NetworkPeersSearcher } from '../../../../contexts/networks/application/search-network-peers/NetworkPeersSearcher';
import type { NodeNetworksSearcher } from '../../../../contexts/networks/application/search-node-networks/NodeNetworksSearcher';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { PigeonNetworksFacade } from '../../../../app/composition/networks/PigeonNetworksFacade';
import { PigeonNodeFacade } from '../../../../app/composition/networks/PigeonNodeFacade';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityAccessContexts } from '../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { NetworkPeer } from '../../../../contexts/networks/domain/entities/NetworkPeer';
import { Network } from '../../../../contexts/networks/domain/Network';

describe(PigeonNetworksFacade.name, () => {
  let identities: IdentityAccessContexts;
  let networkCreator: MockProxy<NetworkCreator>;
  let networkJoiner: MockProxy<NetworkJoiner>;
  let networkSearcher: MockProxy<NodeNetworksSearcher>;
  let networkRemover: MockProxy<NodeNetworkRemover>;
  let networkPeersSearcher: MockProxy<NetworkPeersSearcher>;
  let node: MockProxy<PigeonNodeFacade>;
  let facade: PigeonNetworksFacade;

  beforeEach(() => {
    identities = new IdentityAccessContexts();
    networkCreator = mock<NetworkCreator>();
    networkJoiner = mock<NetworkJoiner>();
    networkSearcher = mock<NodeNetworksSearcher>();
    networkRemover = mock<NodeNetworkRemover>();
    networkPeersSearcher = mock<NetworkPeersSearcher>();
    node = mock<PigeonNodeFacade>();
    facade = new PigeonNetworksFacade(
      identities,
      networkCreator,
      networkJoiner,
      networkSearcher,
      networkRemover,
      networkPeersSearcher,
      node,
    );
  });

  it('registers the session and sends primitive input through the create message', async () => {
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;

    await facade.createForNode(session, 'Builders');

    const message = networkCreator.create.mock.calls[0]?.[0];

    if (!message) throw new Error('Expected create message.');

    expect(message.getActorId().toString()).toBe('identity-a');
    expect(message.getName().toString()).toBe('Builders');
    expect(identities.find(IdentityId.fromString('identity-a')).session).toBe(
      session,
    );
  });

  it('maps searched aggregates to presentation view models', async () => {
    networkSearcher.search.mockResolvedValue([
      Network.fromPrimitives({
        id: 'network-a',
        key: 'private-key',
        name: 'Builders',
        status: 'attached',
      }),
    ]);

    await expect(facade.list()).resolves.toEqual([
      {
        id: 'network-a',
        key: 'private-key',
        name: 'Builders',
      },
    ]);
  });

  it('delegates public-network creation without inventing an application message', async () => {
    await facade.createPublic();

    expect(node.createPublicNetwork).toHaveBeenCalledWith(undefined);
  });

  it('maps peer entities returned by the search use case', async () => {
    networkPeersSearcher.search.mockResolvedValue([
      NetworkPeer.fromPrimitives({
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
        id: 'peer-a',
        lastSeenAt: 100,
        networks: [{ id: 'network-a', name: 'Builders' }],
        nodeType: 'reachable',
        owner: 'identity-a',
      }),
    ]);

    await expect(facade.peers()).resolves.toEqual([
      expect.objectContaining({ id: 'peer-a', nodeType: 'reachable' }),
    ]);
  });
});
