import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

import { IdentityId } from '../../domain/value-objects/IdentityId';

/**
 * Short, comparable fingerprint of a key: the first 128 bits of a SHA-256
 * digest in groups of four hex digits. Public keys hash their DER bytes.
 * Secrets hash under a domain label, so the fingerprint never equals a hash
 * any protocol derives from the same secret and cannot stand in for it.
 */
export class KeyFingerprint {
  private static readonly SECRET_DOMAIN = 'pigeon-swarm:key-fingerprint:v1\n';
  private static readonly DISPLAY_HEX_DIGITS = 32;

  private static format(bytes: Buffer): string {
    return SHA256Hash.from(bytes)
      .valueOf()
      .slice(0, KeyFingerprint.DISPLAY_HEX_DIGITS)
      .toUpperCase()
      .replace(/(.{4})(?!$)/g, '$1 ');
  }

  /** A public key as an identity id: bare base64 DER or a PEM block. */
  public static ofPublicKey(publicKey: string): string {
    return KeyFingerprint.ofPublicBytes(
      Buffer.from(IdentityId.normalize(publicKey), 'base64'),
    );
  }

  public static ofPublicBytes(bytes: Uint8Array): string {
    return KeyFingerprint.format(Buffer.from(bytes));
  }

  public static ofSecret(secret: Uint8Array): string {
    return KeyFingerprint.format(
      Buffer.concat([Buffer.from(KeyFingerprint.SECRET_DOMAIN), secret]),
    );
  }
}
