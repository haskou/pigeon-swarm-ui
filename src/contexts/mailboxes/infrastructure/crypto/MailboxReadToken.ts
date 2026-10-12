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
  private static readonly DEVICE_LABEL = 'pigeon/mailbox/device-read/v1';
  private static readonly ROOT_KEY_BYTES = 32;

  /**
   * Context is `label ‖ mailboxId`. The label is a fixed prefix, so the
   * encoding is unambiguous.
   */
  public static derive(rootKey: Uint8Array, mailboxId: string): string {
    MailboxReadToken.assertRootKey(rootKey);

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

  /**
   * Per-device reader: the same root key bound to one device credential, so
   * each device joins the inbox with its own token and can be removed alone.
   * Context is `label ‖ u32be(len(mailboxId)) ‖ mailboxId ‖ credential`; the
   * length prefix keeps the two variable fields from shifting into each other.
   */
  public static deriveDevice(
    rootKey: Uint8Array,
    mailboxId: string,
    deviceCredential: string,
  ): string {
    MailboxReadToken.assertRootKey(rootKey);

    if (mailboxId.length === 0) {
      throw new RangeError('Mailbox id is required');
    }

    if (deviceCredential.length === 0) {
      throw new RangeError('Device credential is required');
    }

    const id = new TextEncoder().encode(mailboxId);
    const idLength = new Uint8Array(4);
    new DataView(idLength.buffer).setUint32(0, id.length, false);

    return encodeBase64Url(
      hkdf(
        sha256,
        rootKey,
        undefined,
        concatBytes(
          new TextEncoder().encode(MailboxReadToken.DEVICE_LABEL),
          idLength,
          id,
          new TextEncoder().encode(deviceCredential),
        ),
        32,
      ),
    );
  }

  private static assertRootKey(rootKey: Uint8Array): void {
    if (rootKey.length !== MailboxReadToken.ROOT_KEY_BYTES) {
      throw new RangeError('Mailbox root key must be 32 bytes');
    }
  }
}
