import { StringValueObject } from '@haskou/value-objects';

import { CallNetworkIdRequiredError } from '../errors/CallNetworkIdRequiredError';

export class CallNetworkId extends StringValueObject {
  public static fromString(value: string): CallNetworkId {
    const normalized = value.trim();

    if (!normalized) throw new CallNetworkIdRequiredError();

    return new CallNetworkId(normalized);
  }

  private constructor(value: string) {
    super(value);
  }
}
