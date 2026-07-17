import { StringValueObject } from '@haskou/value-objects';

export class CommunityDescription extends StringValueObject {
  public static readonly MAX_LENGTH = 500;

  public static fromString(value: string): CommunityDescription {
    return new CommunityDescription(value.trim());
  }

  private constructor(value: string) {
    super(value, CommunityDescription.MAX_LENGTH);
  }
}
