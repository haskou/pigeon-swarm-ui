import { sha256 } from '@noble/hashes/sha2.js';

/**
 * Hashcash proof the node requires to create a mailbox. Mirrors the node's
 * `MailboxCreationProof`: SHA-256 over
 * `pigeon-mailbox-creation:v1:<mailboxId>:<postTokenHash>:<readTokenHash>:<nonce>`
 * must start with 16 zero bits. Binding the id and both capability hashes stops
 * a proof solved for one mailbox from being replayed for another.
 */
export class MailboxCreationProof {
  public static readonly DIFFICULTY_BITS = 16;
  public static readonly MAX_NONCE_LENGTH = 64;
  private static readonly DOMAIN = 'pigeon-mailbox-creation:v1';

  private static leadingZeroBits(digest: Uint8Array): number {
    let bits = 0;

    for (const byte of digest) {
      if (byte === 0) {
        bits += 8;
        continue;
      }

      return bits + Math.clz32(byte) - 24;
    }

    return bits;
  }

  public static preimage(
    mailboxId: string,
    postTokenHash: string,
    readTokenHash: string,
    nonce: string,
  ): string {
    return [
      MailboxCreationProof.DOMAIN,
      mailboxId,
      postTokenHash,
      readTokenHash,
      nonce,
    ].join(':');
  }

  public static isValid(
    mailboxId: string,
    postTokenHash: string,
    readTokenHash: string,
    nonce: string,
  ): boolean {
    if (
      nonce.length === 0 ||
      nonce.length > MailboxCreationProof.MAX_NONCE_LENGTH
    ) {
      return false;
    }

    const digest = sha256(
      new TextEncoder().encode(
        MailboxCreationProof.preimage(
          mailboxId,
          postTokenHash,
          readTokenHash,
          nonce,
        ),
      ),
    );

    return (
      MailboxCreationProof.leadingZeroBits(digest) >=
      MailboxCreationProof.DIFFICULTY_BITS
    );
  }

  /**
   * Returns the first counter nonce that satisfies the difficulty. Synchronous
   * and CPU-bound by design: it runs in the mining worker, never on the UI thread.
   */
  public static mine(
    mailboxId: string,
    postTokenHash: string,
    readTokenHash: string,
  ): string {
    for (let counter = 0; ; counter += 1) {
      const nonce = counter.toString();

      if (
        MailboxCreationProof.isValid(
          mailboxId,
          postTokenHash,
          readTokenHash,
          nonce,
        )
      ) {
        return nonce;
      }
    }
  }
}
