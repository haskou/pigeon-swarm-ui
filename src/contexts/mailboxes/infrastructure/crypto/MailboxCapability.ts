import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, randomBytes } from '@noble/hashes/utils.js';
import { Buffer } from 'buffer';

/**
 * Bearer capabilities for a mailbox. The node stores only the SHA-256 hex of
 * the post token and read token, so the raw tokens never leave the client
 * except as the Authorization bearer header.
 */
export class MailboxCapability {
  private static readonly TOKEN_BYTES = 32;

  /**
   * 32 random bytes as base64url. The recipient chooses it and keeps it to
   * read and acknowledge.
   */
  public static generate(): string {
    return Buffer.from(randomBytes(MailboxCapability.TOKEN_BYTES)).toString(
      'base64url',
    );
  }

  public static hash(token: string): string {
    return bytesToHex(sha256(new TextEncoder().encode(token)));
  }
}
