import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes } from '@noble/hashes/utils.js';

import type { DirectMessageRecord } from '../../../mailboxes/domain/DirectMessageRecord';

import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';
import { IdentityMatch } from '../../../identities/domain/IdentityMatch';

/**
 * Authorship tag for a record this identity writes to its own inbox: a
 * 32-byte HKDF-SHA256 output over the identity user root key and the record.
 * The peer holds the conversation secret, which keys the self-inbox, but never
 * the root key, so it cannot make a tag that verifies. A record whose author is
 * this identity is applied only with a valid tag.
 */
export class DirectMessageAuthorship {
  private static readonly LABEL = 'pigeon/mailbox/own-record/v1';
  private static readonly ROOT_KEY_BYTES = 32;

  /**
   * Context is `label ‖ canonical record bytes`. The record is the last field,
   * so the fixed label keeps the encoding unambiguous. Canonical bytes are the
   * record JSON with keys sorted, so the tag does not depend on property order.
   * The key set is part of the bytes: a field added or removed changes the tag.
   */
  public static tag(rootKey: Uint8Array, record: DirectMessageRecord): string {
    if (rootKey.length !== DirectMessageAuthorship.ROOT_KEY_BYTES) {
      throw new RangeError('Mailbox root key must be 32 bytes');
    }

    return encodeBase64Url(
      hkdf(
        sha256,
        rootKey,
        undefined,
        concatBytes(
          new TextEncoder().encode(DirectMessageAuthorship.LABEL),
          new TextEncoder().encode(
            JSON.stringify(record, Object.keys(record).sort()),
          ),
        ),
        32,
      ),
    );
  }

  public static verify(
    rootKey: Uint8Array,
    record: DirectMessageRecord,
    authorTag: string,
  ): boolean {
    return authorTag === DirectMessageAuthorship.tag(rootKey, record);
  }

  /**
   * A record authored by another identity is not checked here. A record
   * authored by this identity must carry a tag made under its root key, so a
   * peer that writes into the self-inbox cannot forge or replay it.
   */
  public static isAuthentic(
    identityId: string,
    rootKey: Uint8Array,
    record: DirectMessageRecord,
    authorTag: string | undefined,
  ): boolean {
    if (!IdentityMatch.isSame(record.authorId, identityId)) {
      return true;
    }

    return (
      authorTag !== undefined &&
      DirectMessageAuthorship.verify(rootKey, record, authorTag)
    );
  }
}
