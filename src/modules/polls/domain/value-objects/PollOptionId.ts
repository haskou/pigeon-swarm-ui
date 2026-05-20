import { DomainError, StringValueObject } from '@haskou/value-objects';

export class PollOptionId extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }

  public static fromString(value: string): PollOptionId {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new DomainError('Poll option id is required.');
    }

    return new PollOptionId(trimmedValue);
  }
}
