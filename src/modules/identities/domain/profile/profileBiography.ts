import { StringValueObject } from '@haskou/value-objects';

export class ProfileBiography extends StringValueObject {
  public static readonly MAX_LENGTH = 100;

  public static fromString(
    value: string | StringValueObject,
  ): ProfileBiography {
    return new ProfileBiography(value);
  }

  public constructor(value: string | StringValueObject) {
    super(value, ProfileBiography.MAX_LENGTH);
  }
}
