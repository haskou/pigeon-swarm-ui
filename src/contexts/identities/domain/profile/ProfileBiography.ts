import { StringValueObject } from '@haskou/value-objects';

import { IDENTITY_PROFILE_BIOGRAPHY_MAX_LENGTH } from './IdentityProfileConstraints';

export class ProfileBiography extends StringValueObject {
  public static readonly MAX_LENGTH = IDENTITY_PROFILE_BIOGRAPHY_MAX_LENGTH;

  public static fromString(
    value: string | StringValueObject,
  ): ProfileBiography {
    return new ProfileBiography(value);
  }

  public constructor(value: string | StringValueObject) {
    super(value, ProfileBiography.MAX_LENGTH);
  }
}
