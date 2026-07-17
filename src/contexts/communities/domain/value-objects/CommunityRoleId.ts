import { StringValueObject, assert } from '@haskou/value-objects';

import { CommunityRoleNotFoundError } from '../errors/CommunityRoleNotFoundError';

export class CommunityRoleId extends StringValueObject {
  public static fromString(value: string): CommunityRoleId {
    return new CommunityRoleId(value.trim());
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new CommunityRoleNotFoundError());
  }
}
