import { DomainError, StringValueObject } from '@haskou/value-objects';

export class CommunityId extends StringValueObject {
  public static fromString(value: string): CommunityId {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new DomainError('Community id is required.');
    }

    return new CommunityId(trimmedValue);
  }

  private constructor(value: string) {
    super(value);
  }
}
