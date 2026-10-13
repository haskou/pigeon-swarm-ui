import { Integer, InvalidFormatError, assert } from '@haskou/value-objects';

/** Version of a published keychain. Versions only move forward. */
export class KeychainVersion extends Integer {
  public static fromNumber(value: number): KeychainVersion {
    assert(
      Number.isInteger(value) && value >= 0,
      new InvalidFormatError('keychain version'),
    );

    return new KeychainVersion(value);
  }

  private constructor(value: number) {
    super(value);
  }
}
