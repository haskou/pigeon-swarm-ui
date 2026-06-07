import { DomainError, StringValueObject } from '@haskou/value-objects';

export class MessageId extends StringValueObject {
  public static fromString(value: string): MessageId {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new DomainError('Message id is required.');
    }

    return new MessageId(trimmedValue);
  }

  private constructor(value: string) {
    super(value);
  }
}
