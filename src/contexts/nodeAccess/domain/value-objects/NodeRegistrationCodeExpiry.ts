import { Timestamp, assert } from '@haskou/value-objects';

import { InvalidNodeRegistrationCodeExpiryError } from '../errors/InvalidNodeRegistrationCodeExpiryError';

/** When a registration code stops working; the node caps how far ahead. */
export class NodeRegistrationCodeExpiry extends Timestamp {
  public static fromMilliseconds(value: number): NodeRegistrationCodeExpiry {
    assert(
      Number.isSafeInteger(value),
      new InvalidNodeRegistrationCodeExpiryError(),
    );

    return new NodeRegistrationCodeExpiry(value);
  }

  public static future(
    value: number,
    now: Timestamp,
  ): NodeRegistrationCodeExpiry {
    const expiry = this.fromMilliseconds(value);

    assert(expiry.isAfter(now), new InvalidNodeRegistrationCodeExpiryError());

    return expiry;
  }

  private constructor(value: number) {
    super(value);
  }
}
