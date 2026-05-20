import { StringValueObject } from '@haskou/value-objects';

export class ProfileName extends StringValueObject {
  public static readonly MAX_LENGTH = 20;

  public static fromString(value: string | StringValueObject): ProfileName {
    return new ProfileName(value);
  }

  public constructor(value: string | StringValueObject) {
    super(value, ProfileName.MAX_LENGTH);
  }
}
