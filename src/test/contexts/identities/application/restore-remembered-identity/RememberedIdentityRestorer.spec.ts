import { mock } from 'jest-mock-extended';

import type { IdentityUnlockRepository } from '../../../../../contexts/identities/domain/repositories/IdentityUnlockRepository';

import { RestoreRememberedIdentityMessage } from '../../../../../contexts/identities/application/restore-remembered-identity/messages/RestoreRememberedIdentityMessage';
import { RememberedIdentityRestorer } from '../../../../../contexts/identities/application/restore-remembered-identity/RememberedIdentityRestorer';
import { Identity } from '../../../../../contexts/identities/domain/Identity';

describe(RememberedIdentityRestorer.name, () => {
  it('restores the remembered identity through its repository', async () => {
    const repository = mock<IdentityUnlockRepository>();
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

    repository.restore.mockResolvedValue(identity);

    await expect(
      new RememberedIdentityRestorer(repository).restore(
        new RestoreRememberedIdentityMessage('identity-a'),
      ),
    ).resolves.toBe(identity);
    expect(repository.restore).toHaveBeenCalledWith(expect.anything());
  });
});
