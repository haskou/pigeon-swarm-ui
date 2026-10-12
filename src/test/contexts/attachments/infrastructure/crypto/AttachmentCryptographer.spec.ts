import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { AttachmentBinaryCodec } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentBinaryCodec';
import { AttachmentCryptographer } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentCryptographer';
import { AttachmentLengthPadding } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentLengthPadding';

describe(AttachmentCryptographer.name, () => {
  it('encrypts and decrypts attachment bytes', () => {
    const codec = new AttachmentBinaryCodec();
    const cryptographer = new AttachmentCryptographer(codec);
    const source = new TextEncoder().encode('private content');
    const encrypted = cryptographer.encrypt(
      'private.txt',
      codec.bytesToArrayBuffer(source),
    );
    const decrypted = cryptographer.decrypt(
      {
        cid: 'cid',
        contentType: 'text/plain',
        encryption: encrypted.encryption,
        filename: 'private.txt',
        size: source.byteLength,
      },
      encrypted.encryptedBytes,
    );

    expect(new TextDecoder().decode(decrypted.bytes)).toBe('private content');
  });

  it('rejects attachments without encryption metadata', () => {
    const cryptographer = new AttachmentCryptographer(
      new AttachmentBinaryCodec(),
    );

    expect(() =>
      cryptographer.decrypt(
        {
          cid: 'cid',
          contentType: 'text/plain',
          filename: 'public.txt',
          size: 1,
        },
        new ArrayBuffer(0),
      ),
    ).toThrow('Attachment is not encrypted.');
  });

  it('decrypts ciphertext produced by the previous no-AAD attachment format', () => {
    const codec = new AttachmentBinaryCodec();
    const key = randomBytes(32);
    const iv = randomBytes(12);
    const source = Buffer.from([0, 255, 128, 1, 2]);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(source),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
    const result = new AttachmentCryptographer(codec).decrypt(
      {
        cid: 'cid',
        contentType: 'application/octet-stream',
        encryption: {
          algorithm: 'AES-GCM',
          iv: iv.toString('base64'),
          key: key.toString('base64'),
        },
        filename: 'old.bin',
        size: source.length,
      },
      codec.bytesToArrayBuffer(encrypted),
    );
    expect(Buffer.from(result.bytes)).toEqual(source);
  });

  it.each([0, 17, 8 * 1024 * 1024 + 9])(
    'preserves the no-AAD binary format for %i bytes',
    (size) => {
      const codec = new AttachmentBinaryCodec();
      const source = new Uint8Array(size).fill(191);
      const result = new AttachmentCryptographer(codec).encrypt(
        'file.bin',
        codec.bytesToArrayBuffer(source),
      );
      const decoded: Buffer[] = [];
      let offset = 0;
      for (const chunk of result.encryption.chunks ?? []) {
        const encrypted = Buffer.from(
          result.encryptedBytes.slice(offset, offset + chunk.size),
        );
        const decipher = createDecipheriv(
          'aes-256-gcm',
          Buffer.from(result.encryption.key, 'base64'),
          Buffer.from(chunk.iv, 'base64'),
        );
        decipher.setAuthTag(encrypted.subarray(-16));
        decoded.push(
          Buffer.concat([
            decipher.update(encrypted.subarray(0, -16)),
            decipher.final(),
          ]),
        );
        offset += chunk.size;
      }
      expect(offset).toBe(result.encryptedBytes.byteLength);
      expect(
        Buffer.concat(decoded).equals(
          Buffer.from(AttachmentLengthPadding.pad(source)),
        ),
      ).toBe(true);
    },
  );

  it('rejects a modified authentication tag', () => {
    const codec = new AttachmentBinaryCodec();
    const cryptographer = new AttachmentCryptographer(codec);
    const encrypted = cryptographer.encrypt('file.bin', new ArrayBuffer(3));
    const bytes = new Uint8Array(encrypted.encryptedBytes);
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] + 1) % 256;
    expect(() =>
      cryptographer.decrypt(
        {
          cid: 'cid',
          contentType: 'application/octet-stream',
          encryption: encrypted.encryption,
          filename: 'file.bin',
          size: 3,
        },
        encrypted.encryptedBytes,
      ),
    ).toThrow();
  });

  it('pads plaintext so equal buckets produce equal ciphertext sizes', () => {
    const codec = new AttachmentBinaryCodec();
    const cryptographer = new AttachmentCryptographer(codec);
    const small = cryptographer.encrypt(
      'a.bin',
      codec.bytesToArrayBuffer(new Uint8Array(3)),
    );
    const larger = cryptographer.encrypt(
      'b.bin',
      codec.bytesToArrayBuffer(new Uint8Array(900)),
    );

    expect(small.encryption.padding).toBe('length-prefix-v1');
    expect(small.encryptedBytes.byteLength).toBe(1024 + 16);
    expect(larger.encryptedBytes.byteLength).toBe(
      small.encryptedBytes.byteLength,
    );
  });

  it('keeps the largest padded frame within the 50 MiB blob limit', () => {
    const codec = new AttachmentBinaryCodec();
    const cryptographer = new AttachmentCryptographer(codec);
    const encrypted = cryptographer.encrypt(
      'top.bin',
      codec.bytesToArrayBuffer(new Uint8Array(50 * 1024 * 1024 - 7 * 16 - 16)),
    );

    expect(encrypted.encryptedBytes.byteLength).toBe(50 * 1024 * 1024);
  });

  it('decrypts padded ciphertext spanning several chunks back to the original bytes', () => {
    const codec = new AttachmentBinaryCodec();
    const cryptographer = new AttachmentCryptographer(codec);
    const source = new Uint8Array(8 * 1024 * 1024 + 9).fill(42);
    const encrypted = cryptographer.encrypt(
      'big.bin',
      codec.bytesToArrayBuffer(source),
    );
    const chunkTotal = (encrypted.encryption.chunks ?? []).reduce(
      (sum, chunk) => sum + chunk.size,
      0,
    );

    expect(encrypted.encryption.chunks).toHaveLength(2);
    expect(chunkTotal).toBe(encrypted.encryptedBytes.byteLength);

    const decrypted = cryptographer.decrypt(
      {
        cid: 'cid',
        contentType: 'application/octet-stream',
        encryption: encrypted.encryption,
        filename: 'big.bin',
        size: source.byteLength,
      },
      encrypted.encryptedBytes,
    );

    // equals(): toEqual on failure would diff megabytes and exhaust the heap.
    expect(Buffer.from(decrypted.bytes).equals(Buffer.from(source))).toBe(true);
  });

  it('rejects a padding marker whose plaintext has no valid frame', () => {
    const codec = new AttachmentBinaryCodec();
    const key = randomBytes(32);
    const iv = randomBytes(12);
    const source = Buffer.from([0, 255, 128, 1, 2]);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(source),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    expect(() =>
      new AttachmentCryptographer(codec).decrypt(
        {
          cid: 'cid',
          contentType: 'application/octet-stream',
          encryption: {
            algorithm: 'AES-GCM',
            iv: iv.toString('base64'),
            key: key.toString('base64'),
            padding: 'length-prefix-v1',
          },
          filename: 'bad.bin',
          size: source.length,
        },
        codec.bytesToArrayBuffer(encrypted),
      ),
    ).toThrow('Attachment padding is invalid.');
  });
});
