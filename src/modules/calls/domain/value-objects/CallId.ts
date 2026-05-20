import { DomainError, StringValueObject } from '@haskou/value-objects';

export class CallId extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }

  public static fromString(value: string): CallId {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new DomainError('Call id is required.');
    }

    return new CallId(trimmedValue);
  }
}
