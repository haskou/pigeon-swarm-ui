import { IdentityMasterKeyProtection } from '../../../../../contexts/identities/domain/value-objects/IdentityMasterKeyProtection';
import { RecoveryKey } from '../../../../../contexts/identities/domain/value-objects/RecoveryKey';

describe(IdentityMasterKeyProtection.name, () => {
  it('hydrates and serializes all master-key protection factors', () => {
    const recoveryKey = RecoveryKey.generate().toString();
    const protection = IdentityMasterKeyProtection.fromPrimitives({
      passkeyPrfEnabled: true,
      password: 'Correct-Horse-Battery-9!',
      recoveryKey,
    });

    expect(protection.toPrimitives()).toEqual({
      passkeyPrfEnabled: true,
      password: 'Correct-Horse-Battery-9!',
      recoveryKey,
    });
  });
});
