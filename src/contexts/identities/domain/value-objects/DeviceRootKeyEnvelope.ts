import { ProtectedUserRootKey } from '@haskou/pigeon-swarm-crypto';
import {
  InvalidFormatError,
  StringValueObject,
  assert,
} from '@haskou/value-objects';
import { Buffer } from 'buffer';

const ENVELOPE_HEADER = 'v1.scrypt.N262144.r8.p1.hkdf-sha256.aes-256-gcm';
const ENVELOPE_PARTS = 11;

export class DeviceRootKeyEnvelope extends StringValueObject {
  private static isCanonicalBase64(value: string, length: number): boolean {
    const bytes = Buffer.from(value, 'base64');

    return bytes.byteLength === length && bytes.toString('base64') === value;
  }

  public static fromProtectedUserRootKey(
    protectedRootKey: ProtectedUserRootKey,
  ): DeviceRootKeyEnvelope {
    return DeviceRootKeyEnvelope.fromString(protectedRootKey.valueOf());
  }

  public static fromString(value: string): DeviceRootKeyEnvelope {
    const parts = value.split('.');
    const valid =
      parts.length === ENVELOPE_PARTS &&
      parts.slice(0, 7).join('.') === ENVELOPE_HEADER &&
      DeviceRootKeyEnvelope.isCanonicalBase64(parts[7], 16) &&
      DeviceRootKeyEnvelope.isCanonicalBase64(parts[8], 12) &&
      DeviceRootKeyEnvelope.isCanonicalBase64(parts[9], 16) &&
      DeviceRootKeyEnvelope.isCanonicalBase64(parts[10], 32);

    assert(valid, new InvalidFormatError('[redacted device root envelope]'));

    return new DeviceRootKeyEnvelope(value);
  }

  private constructor(value: string) {
    super(value);
  }

  public getProtectedUserRootKey(): ProtectedUserRootKey {
    return new ProtectedUserRootKey(this.valueOf());
  }

  public serialize(): string {
    return this.valueOf();
  }

  public toJSON(): never {
    throw new InvalidFormatError('[redacted device root envelope]');
  }
}
