import { mock } from 'jest-mock-extended';

import type { NetworkNodeRepository } from '../../../../../contexts/networks/domain/repositories/NetworkNodeRepository';

import { CreatePublicNetworkMessage } from '../../../../../contexts/networks/application/create-public-network/messages/CreatePublicNetworkMessage';
import { PublicNetworkCreator } from '../../../../../contexts/networks/application/create-public-network/PublicNetworkCreator';
import { NetworkNode } from '../../../../../contexts/networks/domain/aggregates/NetworkNode';

describe(PublicNetworkCreator.name, () => {
  it('attaches a public network through the node aggregate', async () => {
    const nodes = mock<NetworkNodeRepository>();
    const node = NetworkNode.fromPrimitives({
      id: 'node-a',
      ownerId: undefined,
      publicNetworkAttached: false,
    });
    nodes.find.mockResolvedValue(node);
    nodes.save.mockImplementation((aggregate) => Promise.resolve(aggregate));

    await new PublicNetworkCreator(nodes).create(
      new CreatePublicNetworkMessage(),
    );

    expect(node.toPrimitives().publicNetworkAttached).toBe(true);
    expect(nodes.save.mock.calls[0]?.[0]).toBe(node);
    expect(nodes.save.mock.calls[0]?.[1].isAnonymous()).toBe(true);
  });
});
