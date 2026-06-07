import { DomainError, StringValueObject } from '@haskou/value-objects';

export class PollId extends StringValueObject {
  public static fromString(value: string): PollId {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new DomainError('Poll id is required.');
    }

    return new PollId(trimmedValue);
  }

  private constructor(value: string) {
    super(value);
  }
}
