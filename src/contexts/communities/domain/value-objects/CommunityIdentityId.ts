import { DomainError, StringValueObject } from '@haskou/value-objects';

export class CommunityIdentityId extends StringValueObject {
  private static normalize(value: string): string {
    const trimmedValue = value.trim();

    if (!trimmedValue.includes('-----BEGIN PUBLIC KEY-----')) {
      return trimmedValue;
    }

    return trimmedValue
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s+/g, '');
  }

  public static fromString(value: string): CommunityIdentityId {
    const normalizedValue = CommunityIdentityId.normalize(value);

    if (!normalizedValue) {
      throw new DomainError('Community identity id is required.');
    }

    return new CommunityIdentityId(normalizedValue);
  }

  private constructor(value: string) {
    super(CommunityIdentityId.normalize(value));
  }
}
