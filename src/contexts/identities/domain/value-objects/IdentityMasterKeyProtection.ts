import { IdentityPassword } from './IdentityPassword';
import { RecoveryKey } from './RecoveryKey';

export class IdentityMasterKeyProtection {
  public static fromPrimitives(
    primitives: PrimitiveOf<IdentityMasterKeyProtection>,
  ): IdentityMasterKeyProtection {
    return new IdentityMasterKeyProtection(
      IdentityPassword.fromString(primitives.password),
      primitives.recoveryKey
        ? RecoveryKey.fromString(primitives.recoveryKey)
        : undefined,
      primitives.passkeyPrfEnabled,
    );
  }

  private constructor(
    private readonly password: IdentityPassword,
    private readonly recoveryKey?: RecoveryKey,
    private readonly passkeyPrfEnabled = false,
  ) {}

  public assertRegistrationReady(): void {
    this.password.assertStrong();
  }

  public toPrimitives() {
    return {
      passkeyPrfEnabled: this.passkeyPrfEnabled,
      password: this.password.toString(),
      recoveryKey: this.recoveryKey?.toString(),
    };
  }
}
import type { PrimitiveOf } from '@haskou/value-objects';
