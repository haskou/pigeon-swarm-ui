import { DomainError, StringValueObject } from '@haskou/value-objects';

export class NetworkKey extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }

  public static fromString(value: string): NetworkKey {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new DomainError('Network key is required.');
    }

    return new NetworkKey(trimmedValue);
  }
}
