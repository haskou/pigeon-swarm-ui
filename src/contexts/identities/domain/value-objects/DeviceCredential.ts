import { PublicKey } from '@haskou/pigeon-swarm-crypto';
import {
  InvalidFormatError,
  StringValueObject,
  assert,
} from '@haskou/value-objects';

const PUBLIC_KEY_LENGTH = 113;
const PUBLIC_KEY_PATTERN =
  /^-----BEGIN PUBLIC KEY-----\n[A-Za-z0-9+/=]+\n-----END PUBLIC KEY-----\n$/;

export class DeviceCredential extends StringValueObject {
  public static fromPublicKey(publicKey: PublicKey): DeviceCredential {
    return new DeviceCredential(publicKey.valueOf());
  }

  public static fromString(value: string): DeviceCredential {
    assert(
      value.length === PUBLIC_KEY_LENGTH && PUBLIC_KEY_PATTERN.test(value),
      new InvalidFormatError('[redacted device credential]'),
    );

    return DeviceCredential.fromPublicKey(PublicKey.fromPEM(value));
  }

  private constructor(value: string) {
    super(value);
  }

  public getPublicKey(): PublicKey {
    return PublicKey.fromPEM(this);
  }
}
