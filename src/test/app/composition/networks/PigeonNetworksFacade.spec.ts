import { mock, type MockProxy } from 'jest-mock-extended';

import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { CreateNetwork } from '../../../../contexts/networks/application/create-network/CreateNetwork';
import type { JoinNetwork } from '../../../../contexts/networks/application/join-network/JoinNetwork';
import type { ListNodeNetworks } from '../../../../contexts/networks/application/list-node-networks/ListNodeNetworks';
import type { RemoveNodeNetwork } from '../../../../contexts/networks/application/remove-node-network/RemoveNodeNetwork';
import type { NetworkPeersSearcher } from '../../../../contexts/networks/application/search-network-peers/NetworkPeersSearcher';
import type { PigeonNodeApi } from '../../../../contexts/networks/infrastructure/http/PigeonNodeApi';

import { PigeonNetworksFacade } from '../../../../app/composition/networks/PigeonNetworksFacade';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityAccessContexts } from '../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { Network } from '../../../../contexts/networks/domain/aggregates/Network';

describe(PigeonNetworksFacade.name, () => {
  let identities: IdentityAccessContexts;
  let networkCreator: MockProxy<CreateNetwork>;
  let networkJoiner: MockProxy<JoinNetwork>;
  let networkSearcher: MockProxy<ListNodeNetworks>;
  let networkRemover: MockProxy<RemoveNodeNetwork>;
  let networkPeersSearcher: MockProxy<NetworkPeersSearcher>;
  let node: MockProxy<PigeonNodeApi>;
  let facade: PigeonNetworksFacade;

  beforeEach(() => {
    identities = new IdentityAccessContexts();
    networkCreator = mock<CreateNetwork>();
    networkJoiner = mock<JoinNetwork>();
    networkSearcher = mock<ListNodeNetworks>();
    networkRemover = mock<RemoveNodeNetwork>();
    networkPeersSearcher = mock<NetworkPeersSearcher>();
    node = mock<PigeonNodeApi>();
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
    networkSearcher.list.mockResolvedValue([
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
