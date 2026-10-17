import { PublicKey } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject } from '@haskou/value-objects';

export class IdentityId extends StringValueObject {
  public static fromString(value: string): IdentityId {
    return new IdentityId(value);
  }

  /** Whether `value` is an id the value object accepts. */
  public static isValid(value: string): boolean {
    try {
      IdentityId.fromString(value);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Whether `value` decodes to a canonical public key: the only form an
   * invitation or an admission may name.
   */
  public static isCanonical(value: string): boolean {
    try {
      IdentityId.fromString(value).getPublicKey().toRaw();

      return true;
    } catch {
      return false;
    }
  }

  public static normalize(value: string): string {
    const trimmed = value.trim();

    if (!trimmed.includes('-----BEGIN PUBLIC KEY-----')) return trimmed;

    return trimmed
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s+/g, '');
  }

  private constructor(value: string) {
    super(IdentityId.normalize(value));
  }

  public getPublicKey(): PublicKey {
    return PublicKey.fromPEM(
      `-----BEGIN PUBLIC KEY-----\n${this.valueOf()}\n-----END PUBLIC KEY-----\n`,
    );
  }
}
