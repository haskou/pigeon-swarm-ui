import { StringValueObject, assert } from '@haskou/value-objects';

import { CommunityIdentityIdRequiredError } from '../errors/CommunityIdentityIdRequiredError';

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

    assert(normalizedValue.length > 0, new CommunityIdentityIdRequiredError());

    return new CommunityIdentityId(normalizedValue);
  }

  private constructor(value: string) {
    super(CommunityIdentityId.normalize(value));
  }
}
