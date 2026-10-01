import {
  InvalidFormatError,
  StringValueObject,
  UUID,
  assert,
} from '@haskou/value-objects';

const DEVICE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class DeviceId extends StringValueObject {
  public static fromString(value: string): DeviceId {
    const canonicalValue = value.trim().toLowerCase();

    assert(
      DEVICE_ID_PATTERN.test(canonicalValue),
      new InvalidFormatError('[redacted device id]'),
    );

    return new DeviceId(canonicalValue);
  }

  public static generate(): DeviceId {
    return DeviceId.fromString(UUID.generate().toString());
  }

  private constructor(value: string) {
    super(value);
  }
}
