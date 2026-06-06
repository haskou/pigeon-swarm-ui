import { NetworkName } from '../value-objects/NetworkName';
import { Network } from './Network';

describe('Network', () => {
  it('issues invites only when the node owns the network key', () => {
    const network = Network.fromNodeNetwork({
      id: 'network-a',
      key: 'secret-key',
      name: 'Builders',
    });

    expect(network.canIssueInvite()).toBe(true);
    expect(network.issueInvite()).toEqual({
      id: 'network-a',
      key: 'secret-key',
      name: 'Builders',
    });
  });

  it('records a domain event when the network is renamed', () => {
    const network = Network.fromNodeNetwork({
      id: 'network-a',
      key: 'secret-key',
      name: 'Builders',
    });

    network.rename(NetworkName.fromString('Operators'));

    expect(network.getName().isEqual(NetworkName.fromString('Operators'))).toBe(
      true,
    );
    expect(network.pullDomainEvents()).toHaveLength(1);
  });
});
