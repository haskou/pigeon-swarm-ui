import { RecoveryKey } from '../../../../../contexts/identities/domain/value-objects/RecoveryKey';

describe(RecoveryKey.name, () => {
  it('generates portable recovery keys with psrk1 prefix', () => {
    const recoveryKey = RecoveryKey.generate();

    expect(recoveryKey.valueOf()).toMatch(/^psrk1\./);
    expect(recoveryKey.getBytes()).toHaveLength(32);
  });

  it('rejects invalid recovery keys', () => {
    expect(RecoveryKey.isValid('not-a-recovery-key')).toBe(false);
  });
});
