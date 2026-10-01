import {
  InvalidFormatError,
  StringValueObject,
  assert,
} from '@haskou/value-objects';

const EPOCH_PATTERN =
  /^(?:genesis|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;

export class DeviceAuthorizationEpoch extends StringValueObject {
  public static fromString(value: string): DeviceAuthorizationEpoch {
    const canonicalValue = value.trim().toLowerCase();

    assert(
      EPOCH_PATTERN.test(canonicalValue),
      new InvalidFormatError('[redacted device authorization epoch]'),
    );

    return new DeviceAuthorizationEpoch(canonicalValue);
  }

  public static genesis(): DeviceAuthorizationEpoch {
    return new DeviceAuthorizationEpoch('genesis');
  }

  private constructor(value: string) {
    super(value);
  }
}
