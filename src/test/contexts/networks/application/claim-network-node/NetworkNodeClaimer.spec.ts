import { mock } from 'jest-mock-extended';

import type { NetworkNodeRepository } from '../../../../../contexts/networks/domain/repositories/NetworkNodeRepository';

import { ClaimNetworkNodeMessage } from '../../../../../contexts/networks/application/claim-network-node/messages/ClaimNetworkNodeMessage';
import { NetworkNodeClaimer } from '../../../../../contexts/networks/application/claim-network-node/NetworkNodeClaimer';
import { NetworkNode } from '../../../../../contexts/networks/domain/aggregates/NetworkNode';

describe(NetworkNodeClaimer.name, () => {
  it('claims the loaded node before persisting it', async () => {
    const nodes = mock<NetworkNodeRepository>();
    const node = NetworkNode.fromPrimitives({
      id: 'node-a',
      ownerId: undefined,
      publicNetworkAttached: false,
    });
    nodes.find.mockResolvedValue(node);
    nodes.save.mockImplementation((aggregate) => Promise.resolve(aggregate));

    await new NetworkNodeClaimer(nodes).claim(
      new ClaimNetworkNodeMessage('identity-a'),
    );

    expect(node.toPrimitives().ownerId).toBe('identity-a');
    expect(nodes.save.mock.calls[0]?.[0]).toBe(node);
    expect(nodes.save.mock.calls[0]?.[1].toString()).toBe('identity-a');
  });
});
