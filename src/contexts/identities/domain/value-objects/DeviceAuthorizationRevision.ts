import { Integer, InvalidFormatError, assert } from '@haskou/value-objects';

export class DeviceAuthorizationRevision extends Integer {
  public static fromNumber(value: number): DeviceAuthorizationRevision {
    assert(
      Number.isInteger(value) && value >= 0,
      new InvalidFormatError('[redacted device authorization revision]'),
    );

    return new DeviceAuthorizationRevision(value);
  }

  public static initial(): DeviceAuthorizationRevision {
    return new DeviceAuthorizationRevision(0);
  }

  private constructor(value: number) {
    super(value);
  }

  /** Ascending numeric order, for sorting transitions by revision. */
  public compareTo(other: DeviceAuthorizationRevision): number {
    return this.valueOf() - other.valueOf();
  }

  public next(): DeviceAuthorizationRevision {
    return DeviceAuthorizationRevision.fromNumber(this.valueOf() + 1);
  }
}
