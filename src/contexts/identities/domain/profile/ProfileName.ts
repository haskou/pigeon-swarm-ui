import { StringValueObject } from '@haskou/value-objects';

import { IDENTITY_PROFILE_NAME_MAX_LENGTH } from './IdentityProfileConstraints';

export class ProfileName extends StringValueObject {
  public static readonly MAX_LENGTH = IDENTITY_PROFILE_NAME_MAX_LENGTH;

  public static fromString(value: string | StringValueObject): ProfileName {
    return new ProfileName(value);
  }

  public constructor(value: string | StringValueObject) {
    super(value, ProfileName.MAX_LENGTH);
  }
}
