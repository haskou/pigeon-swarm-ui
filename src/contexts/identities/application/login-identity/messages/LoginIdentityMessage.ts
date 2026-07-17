import { IdentityId } from '../../../domain/value-objects/IdentityId';
import { IdentityMasterKeyProtection } from '../../../domain/value-objects/IdentityMasterKeyProtection';

export class LoginIdentityMessage {
  public constructor(
    private readonly input: {
      identityId: string;
      password: string;
      recoveryKey?: string;
    },
  ) {}

  public getIdentityId(): IdentityId {
    return IdentityId.fromString(this.input.identityId);
  }

  public getProtection(): IdentityMasterKeyProtection {
    return IdentityMasterKeyProtection.fromPrimitives({
      passkeyPrfEnabled: false,
      password: this.input.password,
      recoveryKey: this.input.recoveryKey,
    });
  }
}
