import { IdentityMasterKeyProtection } from '../../../../../contexts/identities/domain/value-objects/IdentityMasterKeyProtection';
import { RecoveryKey } from '../../../../../contexts/identities/domain/value-objects/RecoveryKey';

describe(IdentityMasterKeyProtection.name, () => {
  it('hydrates and serializes password and recovery key', () => {
    const recoveryKey = RecoveryKey.generate().toString();
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
