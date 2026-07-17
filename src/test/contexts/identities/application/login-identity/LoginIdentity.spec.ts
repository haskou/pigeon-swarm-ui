import { mock } from 'jest-mock-extended';

import type { IdentityUnlockRepository } from '../../../../../contexts/identities/domain/repositories/IdentityUnlockRepository';

import { LoginIdentity } from '../../../../../contexts/identities/application/login-identity/LoginIdentity';
import { LoginIdentityMessage } from '../../../../../contexts/identities/application/login-identity/messages/LoginIdentityMessage';
import { Identity } from '../../../../../contexts/identities/domain/Identity';

describe(LoginIdentity.name, () => {
  it('unlocks the identity through its domain repository', async () => {
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

    repository.unlock.mockResolvedValue(identity);

    await expect(
      new LoginIdentity(repository).login(
        new LoginIdentityMessage({
          identityId: 'identity-a',
          password: 'correct horse battery staple!',
        }),
      ),
    ).resolves.toBe(identity);
    expect(repository.unlock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
    );
  });
});
