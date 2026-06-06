import { DomainError, StringValueObject } from '@haskou/value-objects';

export class NetworkId extends StringValueObject {
  public static fromString(value: string): NetworkId {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new DomainError('Network id is required.');
    }

    return new NetworkId(trimmedValue);
  }

  private constructor(value: string) {
    super(value);
  }
}
