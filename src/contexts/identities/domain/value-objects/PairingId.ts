import {
  InvalidFormatError,
  StringValueObject,
  UUID,
  assert,
} from '@haskou/value-objects';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class PairingId extends StringValueObject {
  public static fromString(value: string): PairingId {
    const canonicalValue = value.trim().toLowerCase();

    assert(
      UUID_PATTERN.test(canonicalValue),
      new InvalidFormatError('[redacted pairing id]'),
    );

    return new PairingId(canonicalValue);
  }

  public static generate(): PairingId {
    return PairingId.fromString(UUID.generate().valueOf());
  }

  private constructor(value: string) {
    super(value);
  }
}
