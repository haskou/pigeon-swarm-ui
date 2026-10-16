import { RecoveryKey } from '@haskou/pigeon-swarm-crypto';
import { mock } from 'jest-mock-extended';

import type { IdentityIdFactory } from '../../../../../contexts/identities/domain/IdentityIdFactory';
import type { IdentityRepository } from '../../../../../contexts/identities/domain/repositories/IdentityRepository';

import { RegisterIdentityMessage } from '../../../../../contexts/identities/application/register-identity/messages/RegisterIdentityMessage';
import { RegisterIdentity } from '../../../../../contexts/identities/application/register-identity/RegisterIdentity';
import { InvalidIdentityRegistrationCodeError } from '../../../../../contexts/identities/domain/errors/InvalidIdentityRegistrationCodeError';
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

    const recoveryKey = RecoveryKey.generate();
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
        recoveryKey: recoveryKey.valueOf(),
      }),
    );

    expect(identity.belongsTo(IdentityId.fromString('identity-a'))).toBe(true);
    expect(identity.pullDomainEvents()).toHaveLength(1);
    expect(repository.create).toHaveBeenCalledWith(
      identity,
      expect.anything(),
      null,
    );
    expect(identityIdFactory.create).toHaveBeenCalledWith(
      expect.objectContaining({ valueOf: expect.any(Function) }),
    );
  });

  it('passes the registration code from the link to the repository', async () => {
    const repository = mock<IdentityRepository>();
    const identityIdFactory = mock<IdentityIdFactory>();

    identityIdFactory.create.mockResolvedValue(
      IdentityId.fromString('identity-a'),
    );
    repository.create.mockImplementation((identity) =>
      Promise.resolve(identity),
    );

    await new RegisterIdentity(repository, identityIdFactory).register(
      new RegisterIdentityMessage({
        name: 'Ada Lovelace',
        networks: ['network-a'],
        occurredAt: 100,
        password: 'Correct-Horse-Battery-9!',
        recoveryKey: RecoveryKey.generate().valueOf(),
        registrationCode: ' Q29kZUNvZGVDb2RlQ29kZUNvZGVDb2RlQ29kZUNvZGU ',
      }),
    );

    expect(repository.create.mock.calls[0]?.[2]?.valueOf()).toBe(
      'Q29kZUNvZGVDb2RlQ29kZUNvZGVDb2RlQ29kZUNvZGU',
    );
  });

  it('refuses a malformed registration code before creating keys', async () => {
    const repository = mock<IdentityRepository>();
    const identityIdFactory = mock<IdentityIdFactory>();

    await expect(
      new RegisterIdentity(repository, identityIdFactory).register(
        new RegisterIdentityMessage({
          name: 'Ada Lovelace',
          networks: ['network-a'],
          occurredAt: 100,
          password: 'Correct-Horse-Battery-9!',
          recoveryKey: RecoveryKey.generate().valueOf(),
          registrationCode: 'not a code',
        }),
      ),
    ).rejects.toThrow(InvalidIdentityRegistrationCodeError);
    expect(identityIdFactory.create).not.toHaveBeenCalled();
  });
});
