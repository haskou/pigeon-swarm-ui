import { mock } from 'jest-mock-extended';

import type { NetworkRepository } from '../../../../../contexts/networks/domain/repositories/NetworkRepository';

import { CreateNetworkMessage } from '../../../../../contexts/networks/application/create-network/messages/CreateNetworkMessage';
import { NetworkCreator } from '../../../../../contexts/networks/application/create-network/NetworkCreator';

describe(NetworkCreator.name, () => {
  it('creates a valid aggregate before persistence', async () => {
    const networkRepository = mock<NetworkRepository>();

    networkRepository.create.mockImplementation((network) =>
      Promise.resolve(network),
    );
    const created = await new NetworkCreator(networkRepository).create(
      new CreateNetworkMessage({
        actorIdentityId: 'identity-a',
        name: 'Builders',
      }),
    );

    expect(created.toPrimitives()).toMatchObject({
      name: 'Builders',
      status: 'attached',
    });
    const [persisted, actorId] = networkRepository.create.mock.calls[0] ?? [];

    expect(persisted).toBe(created);
    expect(actorId?.toString()).toBe('identity-a');
  });
});
