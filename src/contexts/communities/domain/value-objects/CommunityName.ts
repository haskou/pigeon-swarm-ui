import { StringValueObject, assert } from '@haskou/value-objects';

import { CommunityNameRequiredError } from '../errors/CommunityNameRequiredError';

export class CommunityName extends StringValueObject {
  public static readonly MAX_LENGTH = 80;

  public static fromString(value: string): CommunityName {
    const trimmedValue = value.trim();

    assert(trimmedValue.length > 0, new CommunityNameRequiredError());

    return new CommunityName(trimmedValue);
  }

  private constructor(value: string) {
    super(value, CommunityName.MAX_LENGTH);
  }
}
