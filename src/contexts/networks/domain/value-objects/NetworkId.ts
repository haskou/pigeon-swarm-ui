import { StringValueObject, UUID } from '@haskou/value-objects';

import { NetworkIdRequiredError } from '../errors/NetworkIdRequiredError';

export class NetworkId extends StringValueObject {
  public static fromString(value: string): NetworkId {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new NetworkIdRequiredError();
    }

    return new NetworkId(trimmedValue);
  }

  public static generate(): NetworkId {
    return new NetworkId(UUID.generate().toString());
  }

  private constructor(value: string) {
    super(value);
  }
}
