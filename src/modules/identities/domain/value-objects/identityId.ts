import { StringValueObject } from '@haskou/value-objects';

export class IdentityId extends StringValueObject {
  private constructor(value: string) {
    super(IdentityId.normalize(value));
  }

  public static fromString(value: string): IdentityId {
    return new IdentityId(value);
  }

  public static normalize(value: string): string {
    const trimmed = value.trim();

    if (!trimmed.includes('-----BEGIN PUBLIC KEY-----')) return trimmed;

    return trimmed
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s+/g, '');
  }
}
