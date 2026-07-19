import { StringValueObject } from '@haskou/value-objects';

import { NetworkNameRequiredError } from '../errors/NetworkNameRequiredError';

export class NetworkName extends StringValueObject {
  public static readonly MAX_LENGTH = 80;

  public static fromString(value: string): NetworkName {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new NetworkNameRequiredError();
    }

    return new NetworkName(trimmedValue);
  }

  private constructor(value: string) {
    super(value, NetworkName.MAX_LENGTH);
  }
}
