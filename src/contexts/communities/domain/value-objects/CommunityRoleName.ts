import { StringValueObject, assert } from '@haskou/value-objects';

import { CommunityRoleNameRequiredError } from '../errors/CommunityRoleNameRequiredError';

export class CommunityRoleName extends StringValueObject {
  public static readonly MAX_LENGTH = 80;

  public static fromString(value: string): CommunityRoleName {
    return new CommunityRoleName(value.trim());
  }

  private constructor(value: string) {
    super(value, CommunityRoleName.MAX_LENGTH);
    assert(!this.isEmpty(), new CommunityRoleNameRequiredError());
  }
}
