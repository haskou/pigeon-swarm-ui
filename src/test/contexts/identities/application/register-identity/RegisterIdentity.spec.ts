import { mock } from 'jest-mock-extended';

import type { IdentityIdFactory } from '../../../../../contexts/identities/domain/IdentityIdFactory';
import type { IdentityRepository } from '../../../../../contexts/identities/domain/repositories/IdentityRepository';

import { RegisterIdentityMessage } from '../../../../../contexts/identities/application/register-identity/messages/RegisterIdentityMessage';
import { RegisterIdentity } from '../../../../../contexts/identities/application/register-identity/RegisterIdentity';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';

describe(RegisterIdentity.name, () => {
  it('creates the aggregate before asking the repository to persist it', async () => {
    const repository = mock<IdentityRepository>();
    const identityIdFactory = mock<IdentityIdFactory>();

    identityIdFactory.create.mockResolvedValue(
      IdentityId.fromString('identity-a'),
    );
    repository.create.mockImplementation((identity) =>
      Promise.resolve(identity),
    );

    const identity = await new RegisterIdentity(
      repository,
      identityIdFactory,
    ).register(
      new RegisterIdentityMessage({
        handle: 'ada',
        name: 'Ada Lovelace',
        networks: ['network-a'],
        occurredAt: 100,
        password: 'Correct-Horse-Battery-9!',
      }),
    );

    expect(identity.belongsTo(IdentityId.fromString('identity-a'))).toBe(true);
    expect(identity.pullDomainEvents()).toHaveLength(1);
    expect(repository.create).toHaveBeenCalledWith(identity, expect.anything());
  });
});
