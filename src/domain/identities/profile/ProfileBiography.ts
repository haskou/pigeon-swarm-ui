import { StringValueObject } from '@haskou/value-objects';

export class ProfileBiography extends StringValueObject {
  public static readonly MAX_LENGTH = 100;

  public constructor(value: string | StringValueObject) {
    super(value, ProfileBiography.MAX_LENGTH);
  }
}
