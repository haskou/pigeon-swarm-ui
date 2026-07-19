import { assert, StringValueObject } from '@haskou/value-objects';

import { NetworkNodeIdRequiredError } from '../errors/NetworkNodeIdRequiredError';

export class NetworkNodeId extends StringValueObject {
  public static fromString(value: string): NetworkNodeId {
    const normalized = value.trim();

    assert(Boolean(normalized), new NetworkNodeIdRequiredError());

    return new NetworkNodeId(normalized);
  }

  private constructor(value: string) {
    super(value);
  }
}
