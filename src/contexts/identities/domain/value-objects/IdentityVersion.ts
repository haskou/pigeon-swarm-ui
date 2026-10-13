import { Integer, InvalidFormatError, assert } from '@haskou/value-objects';

/** Version of a published identity record. Versions only move forward. */
export class IdentityVersion extends Integer {
  public static fromNumber(value: number): IdentityVersion {
    assert(
      Number.isInteger(value) && value >= 0,
      new InvalidFormatError('identity version'),
    );

    return new IdentityVersion(value);
  }

  private constructor(value: number) {
    super(value);
  }
}
