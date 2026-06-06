import { DomainError, StringValueObject } from '@haskou/value-objects';

export class CallIdentityId extends StringValueObject {
  private constructor(value: string) {
    super(CallIdentityId.normalize(value));
  }

  public static fromString(value: string): CallIdentityId {
    const normalizedValue = CallIdentityId.normalize(value);

    if (!normalizedValue) {
      throw new DomainError('Call identity id is required.');
    }

    return new CallIdentityId(normalizedValue);
  }

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
}
