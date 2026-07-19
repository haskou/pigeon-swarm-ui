import {
  assert,
  NullObject,
  StringValueObject,
  UUID,
} from '@haskou/value-objects';

import { NetworkIdRequiredError } from '../errors/NetworkIdRequiredError';

export class NetworkId extends StringValueObject {
  public static fromString(value: string): NetworkId {
    const trimmedValue = value.trim();

    assert(Boolean(trimmedValue), new NetworkIdRequiredError());

    return new NetworkId(trimmedValue);
  }

  public static generate(): NetworkId {
    return new NetworkId(UUID.generate().toString());
  }

  public static fromOptional(value?: string): NetworkId {
    return value ? this.fromString(value) : NullObject.new(NetworkId);
  }

  public constructor(value: string) {
    super(value);
  }

  public isAvailable(): boolean {
    return !NullObject.isNullObject(this);
  }
}
