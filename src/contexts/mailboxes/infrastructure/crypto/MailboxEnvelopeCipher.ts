import { Buffer } from 'buffer';

import {
  decodeBase64Url,
  encodeBase64Url,
} from '../../../../shared/infrastructure/encoding/base64url';
import { MailboxEnvelopeError } from './MailboxEnvelopeError';

/**
 * Seals and opens mailbox envelope bodies.
 *
 * Plaintext is framed as `u32be(length) ‖ plaintext`, zero-padded so the
 * framed block fills a size bucket, then sealed with AES-256-GCM under the
 * envelope key through WebCrypto, so browsers use their native AES-GCM.
 * The wire body is base64url(iv ‖ ciphertext ‖ tag), so its decoded size is
 * exactly one bucket and the node only ever sees bucket sizes. AAD is
 * `<mailboxId>.<envelopeId>`, so a body cannot be moved to another mailbox or
 * relabelled.
 */
export class MailboxEnvelopeCipher {
  private static readonly BASE64URL = /^[A-Za-z0-9_-]+$/;
  private static readonly IV_BYTES = 12;
  private static readonly LENGTH_PREFIX_BYTES = 4;
  private static readonly TAG_BYTES = 16;

  public static readonly BUCKETS: readonly number[] = [
    1024, 4096, 16384, 65536,
  ];

  /** Largest plaintext that fits the top bucket after framing and AEAD. */
  public static readonly MAX_PLAINTEXT_BYTES =
    Math.max(...MailboxEnvelopeCipher.BUCKETS) -
    MailboxEnvelopeCipher.IV_BYTES -
    MailboxEnvelopeCipher.TAG_BYTES -
    MailboxEnvelopeCipher.LENGTH_PREFIX_BYTES;

  private static aad(
    mailboxId: string,
    envelopeId: string,
  ): Uint8Array<ArrayBuffer> {
    return new TextEncoder().encode(`${mailboxId}.${envelopeId}`);
  }

  private static key(envelopeKey: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      'raw',
      new Uint8Array(envelopeKey),
      'AES-GCM',
      false,
      ['encrypt', 'decrypt'],
    );
  }

  /** Sealed wire size, in bytes, for a plaintext of this length. */
  public static bucketFor(plaintextLength: number): number {
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

  public static async seal(
    envelopeKey: Uint8Array,
    mailboxId: string,
    envelopeId: string,
    plaintext: Uint8Array,
  ): Promise<string> {
    const bucket = MailboxEnvelopeCipher.bucketFor(plaintext.length);
    const framed = Buffer.alloc(
      bucket - MailboxEnvelopeCipher.IV_BYTES - MailboxEnvelopeCipher.TAG_BYTES,
    );

    framed.writeUInt32BE(plaintext.length, 0);
    framed.set(plaintext, MailboxEnvelopeCipher.LENGTH_PREFIX_BYTES);

    const iv = crypto.getRandomValues(
      new Uint8Array(MailboxEnvelopeCipher.IV_BYTES),
    );
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt(
        {
          additionalData: MailboxEnvelopeCipher.aad(mailboxId, envelopeId),
          iv,
          name: 'AES-GCM',
          tagLength: MailboxEnvelopeCipher.TAG_BYTES * 8,
        },
        await MailboxEnvelopeCipher.key(envelopeKey),
        new Uint8Array(framed),
      ),
    );

    return encodeBase64Url(Buffer.concat([iv, sealed]));
  }

  /**
   * Rejects with MailboxEnvelopeError for any body that is malformed,
   * mis-sized or fails authentication.
   */
  public static async open(
    envelopeKey: Uint8Array,
    mailboxId: string,
    envelopeId: string,
    body: string,
  ): Promise<Uint8Array> {
    if (!MailboxEnvelopeCipher.BASE64URL.test(body)) {
      throw new MailboxEnvelopeError('Envelope body is not base64url');
    }

    const sealed = new Uint8Array(decodeBase64Url(body));

    if (!MailboxEnvelopeCipher.BUCKETS.includes(sealed.length)) {
      throw new MailboxEnvelopeError('Envelope body is not a bucket size');
    }

    let framed: Buffer;

    try {
      framed = Buffer.from(
        await crypto.subtle.decrypt(
          {
            additionalData: MailboxEnvelopeCipher.aad(mailboxId, envelopeId),
            iv: sealed.subarray(0, MailboxEnvelopeCipher.IV_BYTES),
            name: 'AES-GCM',
            tagLength: MailboxEnvelopeCipher.TAG_BYTES * 8,
          },
          await MailboxEnvelopeCipher.key(envelopeKey),
          sealed.subarray(MailboxEnvelopeCipher.IV_BYTES),
        ),
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
