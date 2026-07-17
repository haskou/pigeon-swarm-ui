import { StringValueObject } from '@haskou/value-objects';

import { CallIdentityIdRequiredError } from '../errors/CallIdentityIdRequiredError';

export class CallIdentityId extends StringValueObject {
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

  public static fromString(value: string): CallIdentityId {
    const normalizedValue = CallIdentityId.normalize(value);

    if (!normalizedValue) {
      throw new CallIdentityIdRequiredError();
    }

    return new CallIdentityId(normalizedValue);
  }

  private constructor(value: string) {
    super(CallIdentityId.normalize(value));
  }
}
