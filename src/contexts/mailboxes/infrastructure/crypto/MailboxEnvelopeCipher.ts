import { EncryptedPayload, SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

import { MailboxEnvelopeError } from './MailboxEnvelopeError';

/**
 * Seals and opens mailbox envelope bodies.
 *
 * Plaintext is framed as `u32be(length) ‖ plaintext`, zero-padded so the framed
 * block fills a size bucket, then sealed with AES-256-GCM under the envelope key.
 * The wire body is base64url(iv ‖ ciphertext ‖ tag), so its decoded size is
 * exactly one bucket and the node only ever sees bucket sizes. AAD is
 * `<mailboxId>.<envelopeId>`, so a body cannot be moved to another mailbox or
 * relabelled.
 */
export class MailboxEnvelopeCipher {
  public static readonly BUCKETS: readonly number[] = [
    1024, 4096, 16384, 65536,
  ];

  private static readonly ALGORITHM = 'v1.aes-256-gcm';
  private static readonly BASE64URL = /^[A-Za-z0-9_-]+$/;
  private static readonly IV_BYTES = 12;
  private static readonly LENGTH_PREFIX_BYTES = 4;
  private static readonly TAG_BYTES = 16;

  private static aad(mailboxId: string, envelopeId: string): string {
    return `${mailboxId}.${envelopeId}`;
  }

  private static bucketFor(plaintextLength: number): number {
    const bucket = MailboxEnvelopeCipher.BUCKETS.find(
      (size) =>
        size -
          MailboxEnvelopeCipher.IV_BYTES -
          MailboxEnvelopeCipher.TAG_BYTES >=
        MailboxEnvelopeCipher.LENGTH_PREFIX_BYTES + plaintextLength,
    );

    if (bucket === undefined) {
      throw new MailboxEnvelopeError(
        'Envelope plaintext exceeds the largest bucket',
      );
    }

    return bucket;
  }

  public static seal(
    envelopeKey: Uint8Array,
    mailboxId: string,
    envelopeId: string,
    plaintext: Uint8Array,
  ): string {
    const bucket = MailboxEnvelopeCipher.bucketFor(plaintext.length);
    const framed = Buffer.alloc(
      bucket -
        MailboxEnvelopeCipher.IV_BYTES -
        MailboxEnvelopeCipher.TAG_BYTES,
    );

    framed.writeUInt32BE(plaintext.length, 0);
    framed.set(plaintext, MailboxEnvelopeCipher.LENGTH_PREFIX_BYTES);

    const payload = SymmetricKey.fromBuffer(Buffer.from(envelopeKey)).encrypt(
      framed,
      { aad: MailboxEnvelopeCipher.aad(mailboxId, envelopeId) },
    );

    // Payload is `v1.aes-256-gcm.<iv>.<ciphertext>.<tag>` with standard base64 parts.
    const sealed = Buffer.concat(
      payload
        .valueOf()
        .split('.')
        .slice(2)
        .map((part) => Buffer.from(part, 'base64')),
    );

    return sealed.toString('base64url');
  }

  /** Throws MailboxEnvelopeError for any body that is malformed, mis-sized or fails authentication. */
  public static open(
    envelopeKey: Uint8Array,
    mailboxId: string,
    envelopeId: string,
    body: string,
  ): Uint8Array {
    if (!MailboxEnvelopeCipher.BASE64URL.test(body)) {
      throw new MailboxEnvelopeError('Envelope body is not base64url');
    }

    const sealed = Buffer.from(body, 'base64url');

    if (!MailboxEnvelopeCipher.BUCKETS.includes(sealed.length)) {
      throw new MailboxEnvelopeError('Envelope body is not a bucket size');
    }

    const iv = sealed
      .subarray(0, MailboxEnvelopeCipher.IV_BYTES)
      .toString('base64');
    const cipherText = sealed
      .subarray(
        MailboxEnvelopeCipher.IV_BYTES,
        sealed.length - MailboxEnvelopeCipher.TAG_BYTES,
      )
      .toString('base64');
    const tag = sealed
      .subarray(sealed.length - MailboxEnvelopeCipher.TAG_BYTES)
      .toString('base64');

    let framed: Buffer;

    try {
      framed = SymmetricKey.fromBuffer(Buffer.from(envelopeKey)).decrypt(
        new EncryptedPayload(
          `${MailboxEnvelopeCipher.ALGORITHM}.${iv}.${cipherText}.${tag}`,
        ),
        { aad: MailboxEnvelopeCipher.aad(mailboxId, envelopeId) },
      );
    } catch {
      throw new MailboxEnvelopeError('Envelope failed authentication');
    }

    const length = framed.readUInt32BE(0);
    const end = MailboxEnvelopeCipher.LENGTH_PREFIX_BYTES + length;

    if (end > framed.length) {
      throw new MailboxEnvelopeError('Envelope length prefix is invalid');
    }

    return framed.subarray(MailboxEnvelopeCipher.LENGTH_PREFIX_BYTES, end);
  }
}
