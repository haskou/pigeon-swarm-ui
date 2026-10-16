import { Integer, InvalidFormatError, assert } from '@haskou/value-objects';

/**
 * Generation of the device-sealed secret publication a session took its root
 * from. Generations of one identity only move forward, so a root published
 * at a higher generation replaced one published at a lower one.
 */
export class DeviceSealedRootGeneration extends Integer {
  public static fromNumber(value: number): DeviceSealedRootGeneration {
    assert(
      Number.isInteger(value) && value >= 0,
      new InvalidFormatError('[redacted device sealed root generation]'),
    );

    return new DeviceSealedRootGeneration(value);
  }

  private constructor(value: number) {
    super(value);
  }
}
