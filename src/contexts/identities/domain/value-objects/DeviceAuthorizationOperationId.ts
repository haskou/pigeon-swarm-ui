import {
  InvalidFormatError,
  StringValueObject,
  UUID,
  assert,
} from '@haskou/value-objects';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class DeviceAuthorizationOperationId extends StringValueObject {
  public static fromString(value: string): DeviceAuthorizationOperationId {
    const canonicalValue = value.trim().toLowerCase();

    assert(
      UUID_PATTERN.test(canonicalValue),
      new InvalidFormatError('[redacted device authorization operation id]'),
    );

    return new DeviceAuthorizationOperationId(canonicalValue);
  }

  public static generate(): DeviceAuthorizationOperationId {
    return DeviceAuthorizationOperationId.fromString(UUID.generate().valueOf());
  }

  private constructor(value: string) {
    super(value);
  }
}
