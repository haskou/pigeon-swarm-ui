import { mock } from 'jest-mock-extended';

import type { NetworkRepository } from '../../../../../contexts/networks/domain/repositories/NetworkRepository';

import { JoinNetworkMessage } from '../../../../../contexts/networks/application/join-network/messages/JoinNetworkMessage';
import { NetworkJoiner } from '../../../../../contexts/networks/application/join-network/NetworkJoiner';

describe(NetworkJoiner.name, () => {
  it('joins using a valid aggregate before persistence', async () => {
    const networkRepository = mock<NetworkRepository>();

    networkRepository.create.mockImplementation((network) =>
      Promise.resolve(network),
    );
    const joined = await new NetworkJoiner(networkRepository).join(
      new JoinNetworkMessage({
        id: 'network-a',
        key: 'secret-key',
        name: 'Builders',
      }),
    );

    expect(joined.toPrimitives()).toEqual({
      id: 'network-a',
      key: 'secret-key',
      name: 'Builders',
      status: 'attached',
    });
    const [persisted, actorId] = networkRepository.create.mock.calls[0] ?? [];

    expect(persisted).toBe(joined);
    expect(actorId?.isAnonymous()).toBe(true);
  });
});
