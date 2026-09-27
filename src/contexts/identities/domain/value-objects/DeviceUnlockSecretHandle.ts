import {
  InvalidFormatError,
  StringValueObject,
  UUID,
  assert,
} from '@haskou/value-objects';

const DEVICE_UNLOCK_SECRET_HANDLE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class DeviceUnlockSecretHandle extends StringValueObject {
  public static fromString(value: string): DeviceUnlockSecretHandle {
    const canonicalValue = value.trim().toLowerCase();

    assert(
      DEVICE_UNLOCK_SECRET_HANDLE_PATTERN.test(canonicalValue),
      new InvalidFormatError('[redacted device unlock secret handle]'),
    );

    return new DeviceUnlockSecretHandle(canonicalValue);
  }

  public static generate(): DeviceUnlockSecretHandle {
    return DeviceUnlockSecretHandle.fromString(UUID.generate().toString());
  }

  private constructor(value: string) {
    super(value);
  }
}
