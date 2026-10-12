import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes } from '@noble/hashes/utils.js';

import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';

/**
 * Recipient read capability for one inbox: a 32-byte token derived from the
 * identity's user root key and the mailbox id. The node keeps only its hash.
 * The peer holds the conversation secret but never the root key, so it cannot
 * derive this token and cannot read, acknowledge or delete the inbox.
 *
 * Deriving the token, instead of storing a random one, lets a device that lost
 * its local storage recover the inbox it created: the root key is restored on
 * every authorized device.
 */
export class MailboxReadToken {
  private static readonly LABEL = 'pigeon/mailbox/read/v1';
  private static readonly ROOT_KEY_BYTES = 32;

  /**
   * Context is `label ‖ mailboxId`. The label is a fixed prefix, so the
   * encoding is unambiguous.
   */
  public static derive(rootKey: Uint8Array, mailboxId: string): string {
    if (rootKey.length !== MailboxReadToken.ROOT_KEY_BYTES) {
      throw new RangeError('Mailbox root key must be 32 bytes');
    }

    if (mailboxId.length === 0) {
      throw new RangeError('Mailbox id is required');
    }

    return encodeBase64Url(
      hkdf(
        sha256,
        rootKey,
        undefined,
        concatBytes(
          new TextEncoder().encode(MailboxReadToken.LABEL),
          new TextEncoder().encode(mailboxId),
        ),
        32,
      ),
    );
  }
}
