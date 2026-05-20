import { DomainError, StringValueObject } from '@haskou/value-objects';

export class NetworkName extends StringValueObject {
  public static readonly MAX_LENGTH = 80;

  private constructor(value: string) {
    super(value, NetworkName.MAX_LENGTH);
  }

  public static fromString(value: string): NetworkName {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new DomainError('Network name is required.');
    }

    return new NetworkName(trimmedValue);
  }
}
