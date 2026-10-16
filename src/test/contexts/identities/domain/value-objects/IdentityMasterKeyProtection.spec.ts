import { RecoveryKey } from '@haskou/pigeon-swarm-crypto';

import { IdentityMasterKeyProtection } from '../../../../../contexts/identities/domain/value-objects/IdentityMasterKeyProtection';

describe(IdentityMasterKeyProtection.name, () => {
  it('hydrates and serializes password and recovery key', () => {
    const recoveryKey = RecoveryKey.generate().valueOf();
    const protection = IdentityMasterKeyProtection.fromPrimitives({
      password: 'Correct-Horse-Battery-9!',
      recoveryKey,
    });

    expect(protection.toPrimitives()).toEqual({
      password: 'Correct-Horse-Battery-9!',
      recoveryKey,
    });
  });
});
