import { StringValueObject, SymmetricKey } from '@haskou/value-objects';

import { NetworkKeyRequiredError } from '../errors/NetworkKeyRequiredError';

export class NetworkKey extends StringValueObject {
  public static fromString(value: string): NetworkKey {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new NetworkKeyRequiredError();
    }

    return new NetworkKey(trimmedValue);
  }

  public static generate(): NetworkKey {
    return new NetworkKey(SymmetricKey.generate().toString());
  }

  private constructor(value: string) {
    super(value);
  }
}
