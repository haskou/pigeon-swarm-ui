import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
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
 * `gen_k`: the generation secret every current member holds. It is exported
 * from the MLS epoch of group creation or of the latest removal commit, so a
 * removed member never learns the next one. Held as 32 bytes of unpadded
 * canonical base64url; a rejected value is never echoed in the error.
 */
export class GroupMailboxGenerationSecret extends StringValueObject {
  private static readonly BYTES = 32;
  private static readonly ENCODED = /^[A-Za-z0-9_-]{43}$/;

  public static fromBytes(bytes: Uint8Array): GroupMailboxGenerationSecret {
    assert(
      bytes.length === GroupMailboxGenerationSecret.BYTES,
      new InvalidFormatError('[redacted group mailbox generation secret]'),
    );

    return new GroupMailboxGenerationSecret(encodeBase64Url(bytes));
  }

  public static fromString(value: string): GroupMailboxGenerationSecret {
    return new GroupMailboxGenerationSecret(value);
  }

  private constructor(value: string) {
    super(value);
    assert(
      GroupMailboxGenerationSecret.ENCODED.test(value) &&
        encodeBase64Url(decodeBase64Url(value)) === value,
      new InvalidFormatError('[redacted group mailbox generation secret]'),
    );
  }

  /** The key the library's group inbox schedule derives from. */
  public toSymmetricKey(): SymmetricKey {
    return SymmetricKey.fromBuffer(decodeBase64Url(this.valueOf()));
  }
}
