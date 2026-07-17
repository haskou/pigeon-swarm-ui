import { StringValueObject, assert } from '@haskou/value-objects';

import { CommunityRoleNotFoundError } from '../errors/CommunityRoleNotFoundError';

export class CommunityRoleId extends StringValueObject {
  public static readonly EVERYONE = CommunityRoleId.fromString('everyone');

  public static fromString(value: string): CommunityRoleId {
    return new CommunityRoleId(value.trim());
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new CommunityRoleNotFoundError());
  }

  public isEveryone(): boolean {
    return this.isEqual(CommunityRoleId.EVERYONE);
  }
}
