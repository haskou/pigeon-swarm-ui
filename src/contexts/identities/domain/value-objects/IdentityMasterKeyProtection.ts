import { assert } from '@haskou/value-objects';

import { IdentityPassword } from './IdentityPassword';
import { RecoveryKey } from './RecoveryKey';

export class IdentityMasterKeyProtection {
  public static fromPrimitives(primitives: {
    password: string;
    recoveryKey?: string | undefined;
  }): IdentityMasterKeyProtection {
    return new IdentityMasterKeyProtection(
      IdentityPassword.fromString(primitives.password),
      primitives.recoveryKey
        ? RecoveryKey.fromString(primitives.recoveryKey)
        : undefined,
    );
  }

  private constructor(
    private readonly password: IdentityPassword,
    private readonly recoveryKey?: RecoveryKey,
  ) {}

  public assertRegistrationReady(): void {
    this.password.assertStrong();
    assert(this.recoveryKey, new Error('A recovery kit is required.'));
  }

  public getRecoveryKey(): RecoveryKey {
    assert(this.recoveryKey, new Error('A recovery kit is required.'));

    return this.recoveryKey;
  }

  public toPrimitives() {
    return {
      password: this.password.toString(),
      recoveryKey: this.recoveryKey?.toString(),
    };
  }
}
