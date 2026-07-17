import { mock } from 'jest-mock-extended';

import type { IdentityRepository } from '../../../../../contexts/identities/domain/repositories/IdentityRepository';

import { IdentityFinder } from '../../../../../contexts/identities/application/find-identity/IdentityFinder';
import { FindIdentityMessage } from '../../../../../contexts/identities/application/find-identity/messages/FindIdentityMessage';
import { Identity } from '../../../../../contexts/identities/domain/Identity';

describe(IdentityFinder.name, () => {
  it('finds an identity through its domain repository', async () => {
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

    repository.find.mockResolvedValue(identity);

    await expect(
      new IdentityFinder(repository).find(
        new FindIdentityMessage('identity-a'),
      ),
    ).resolves.toBe(identity);
    expect(repository.find.mock.calls[0][0].toString()).toBe('identity-a');
  });
});
