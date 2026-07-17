import { StringValueObject, assert } from '@haskou/value-objects';

import { CommunityIdRequiredError } from '../errors/CommunityIdRequiredError';

export class CommunityId extends StringValueObject {
  public static fromString(value: string): CommunityId {
    const trimmedValue = value.trim();

    assert(trimmedValue.length > 0, new CommunityIdRequiredError());

    return new CommunityId(trimmedValue);
  }

  private constructor(value: string) {
    super(value);
  }
}
