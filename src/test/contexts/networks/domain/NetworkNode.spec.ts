import { Timestamp } from '@haskou/value-objects';

import { NetworkNodeAlreadyClaimedError } from '../../../../contexts/networks/domain/errors/NetworkNodeAlreadyClaimedError';
import { PublicNetworkAlreadyAttachedError } from '../../../../contexts/networks/domain/errors/PublicNetworkAlreadyAttachedError';
import { NetworkNodeClaimed } from '../../../../contexts/networks/domain/events/NetworkNodeClaimed';
import { PublicNetworkAttached } from '../../../../contexts/networks/domain/events/PublicNetworkAttached';
import { NetworkNode } from '../../../../contexts/networks/domain/NetworkNode';
import { NetworkNodeOwnerId } from '../../../../contexts/networks/domain/value-objects/NetworkNodeOwnerId';

describe(NetworkNode.name, () => {
  it('claims an unowned node through a domain transition', () => {
    const node = NetworkNode.fromPrimitives({
      id: 'node-a',
      ownerId: undefined,
      publicNetworkAttached: false,
    });

    node.claim(NetworkNodeOwnerId.fromString('identity-a'), new Timestamp(100));

    expect(node.toPrimitives().ownerId).toBe('identity-a');
    expect(node.pullDomainEvents()[0]).toBeInstanceOf(NetworkNodeClaimed);
  });

  it('does not claim an already owned node', () => {
    const node = NetworkNode.fromPrimitives({
      id: 'node-a',
      ownerId: 'identity-a',
      publicNetworkAttached: false,
    });

    expect(() =>
      node.claim(
        NetworkNodeOwnerId.fromString('identity-b'),
        new Timestamp(100),
      ),
    ).toThrow(NetworkNodeAlreadyClaimedError);
  });

  it('attaches the public network once', () => {
    const node = NetworkNode.fromPrimitives({
      id: 'node-a',
      ownerId: undefined,
      publicNetworkAttached: false,
    });

    node.attachPublicNetwork(new Timestamp(100));

    expect(node.toPrimitives().publicNetworkAttached).toBe(true);
    expect(node.pullDomainEvents()[0]).toBeInstanceOf(PublicNetworkAttached);
    expect(() => node.attachPublicNetwork(new Timestamp(200))).toThrow(
      PublicNetworkAlreadyAttachedError,
    );
  });
});
