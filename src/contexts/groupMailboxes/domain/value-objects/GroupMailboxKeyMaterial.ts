import {
  InvalidFormatError,
  StringValueObject,
  assert,
} from '@haskou/value-objects';

import {
  decodeBase64Url,
  encodeBase64Url,
} from '../../../../shared/infrastructure/encoding/base64url';

/**
 * 32 bytes of group mailbox key-schedule input or output, held as unpadded
 * canonical base64url. Most of these values are secrets, so a rejected value
 * is never echoed in the error.
 */
export abstract class GroupMailboxKeyMaterial extends StringValueObject {
  private static readonly BYTES = 32;
  private static readonly ENCODED = /^[A-Za-z0-9_-]{43}$/;

  protected static encode(bytes: Uint8Array): string {
    assert(
      bytes.length === GroupMailboxKeyMaterial.BYTES,
      new InvalidFormatError('[redacted group mailbox key material]'),
    );

    return encodeBase64Url(bytes);
  }

  protected constructor(value: string) {
    super(value);
    assert(
      GroupMailboxKeyMaterial.ENCODED.test(value) &&
        encodeBase64Url(decodeBase64Url(value)) === value,
      new InvalidFormatError('[redacted group mailbox key material]'),
    );
  }

  public getBytes(): Uint8Array {
    return new Uint8Array(decodeBase64Url(this.valueOf()));
  }
}
