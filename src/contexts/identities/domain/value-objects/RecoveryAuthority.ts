import { PublicKey } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject } from '@haskou/value-objects';

import type { DeviceCredential } from './DeviceCredential';

export class RecoveryAuthority extends StringValueObject {
  public static fromString(value: string): RecoveryAuthority {
    return new RecoveryAuthority(value);
  }

  private constructor(value: string) {
    super(value);
  }

  public getPublicKey(): PublicKey {
    return PublicKey.fromPEM(this);
  }

  /** The recovery authority never doubles as the identity or a device key. */
  public isIndependentFrom(credentials: DeviceCredential[]): boolean {
    return credentials.every((credential) => !this.hasValue(credential));
  }
}
