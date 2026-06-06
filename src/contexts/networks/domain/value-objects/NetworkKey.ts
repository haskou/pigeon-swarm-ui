import { DomainError, StringValueObject } from '@haskou/value-objects';

export class NetworkKey extends StringValueObject {
  public static fromString(value: string): NetworkKey {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new DomainError('Network key is required.');
    }

    return new NetworkKey(trimmedValue);
  }

  private constructor(value: string) {
    super(value);
  }
}
