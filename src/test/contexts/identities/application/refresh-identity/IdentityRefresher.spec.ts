import { mock } from 'jest-mock-extended';

import type { IdentityRepository } from '../../../../../contexts/identities/domain/repositories/IdentityRepository';

import { IdentityRefresher } from '../../../../../contexts/identities/application/refresh-identity/IdentityRefresher';
import { RefreshIdentityMessage } from '../../../../../contexts/identities/application/refresh-identity/messages/RefreshIdentityMessage';
import { Identity } from '../../../../../contexts/identities/domain/Identity';

describe(IdentityRefresher.name, () => {
  it('refreshes an identity through its domain repository', async () => {
    const repository = mock<IdentityRepository>();
    const identity = Identity.fromPrimitives({
      createdAt: 100,
      id: 'identity-a',
      networkIds: [],
      profile: {
        banner: undefined,
        biography: undefined,
        handle: undefined,
        name: 'Ada',
        picture: undefined,
      },
    });

    repository.refresh.mockResolvedValue(identity);

    await expect(
      new IdentityRefresher(repository).refresh(
        new RefreshIdentityMessage('identity-a'),
      ),
    ).resolves.toBe(identity);
    expect(repository.refresh.mock.calls[0][0].toString()).toBe('identity-a');
  });
});
