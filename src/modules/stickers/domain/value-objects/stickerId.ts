import { DomainError, StringValueObject } from '@haskou/value-objects';

export class StickerId extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }

  public static fromString(value: string): StickerId {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new DomainError('Sticker id is required.');
    }

    return new StickerId(trimmedValue);
  }
}
