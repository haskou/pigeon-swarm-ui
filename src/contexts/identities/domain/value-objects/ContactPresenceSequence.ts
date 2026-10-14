import { Integer, assert } from '@haskou/value-objects';

import { InvalidContactPresenceError } from '../errors/InvalidContactPresenceError';

/** Monotonic per presence source, starting at 1. */
export class ContactPresenceSequence extends Integer {
  public static first(): ContactPresenceSequence {
    return new ContactPresenceSequence(1);
  }

  public static fromPrimitives(value: number): ContactPresenceSequence {
    return new ContactPresenceSequence(value);
  }

  private constructor(value: number) {
    assert(
      Number.isSafeInteger(value) && value >= 1,
      new InvalidContactPresenceError(),
    );
    super(value);
  }

  public next(): ContactPresenceSequence {
    return new ContactPresenceSequence(this.add(1).valueOf());
  }
}
