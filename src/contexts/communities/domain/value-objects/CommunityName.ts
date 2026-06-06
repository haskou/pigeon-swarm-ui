import { DomainError, StringValueObject } from '@haskou/value-objects';

export class CommunityName extends StringValueObject {
  public static readonly MAX_LENGTH = 80;

  public static fromString(value: string): CommunityName {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new DomainError('Community name is required.');
    }

    return new CommunityName(trimmedValue);
  }

  private constructor(value: string) {
    super(value, CommunityName.MAX_LENGTH);
  }
}
