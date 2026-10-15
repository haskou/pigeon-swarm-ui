import { Integer, assert } from '@haskou/value-objects';

import { InvalidNodeRegistrationCodeUsesError } from '../errors/InvalidNodeRegistrationCodeUsesError';

const maximum = 100;

/** How many identities one registration code may still create. */
export class NodeRegistrationCodeUses extends Integer {
  public static fromNumber(value: number): NodeRegistrationCodeUses {
    assert(
      Number.isInteger(value) && value >= 0 && value <= maximum,
      new InvalidNodeRegistrationCodeUsesError(),
    );

    return new NodeRegistrationCodeUses(value);
  }

  public static allowance(value: number): NodeRegistrationCodeUses {
    assert(value >= 1, new InvalidNodeRegistrationCodeUsesError());

    return this.fromNumber(value);
  }

  private constructor(value: number) {
    super(value);
  }
}
