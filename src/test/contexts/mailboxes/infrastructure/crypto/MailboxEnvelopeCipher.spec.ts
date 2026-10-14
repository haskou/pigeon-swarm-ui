import { Buffer } from 'buffer';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { MailboxEnvelopeCipher } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxEnvelopeCipher';
import { MailboxEnvelopeError } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxEnvelopeError';

describe(MailboxEnvelopeCipher.name, () => {
  const envelopeKey = new Uint8Array(32).fill(7);
  const mailboxId = 'mailbox-under-test';
  const envelopeId = 'envelope-id-0000000000AA';
  const plaintext = new TextEncoder().encode('hello');

  const decodedLength = (body: string): number =>
    Buffer.from(body, 'base64url').length;

  // Seals with node:crypto directly, so the wire layout is checked against an
  // independent implementation.
  const sealWithNode = (framed: Buffer, aad: string): string => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', envelopeKey, iv);

    cipher.setAAD(Buffer.from(aad));

    const cipherText = Buffer.concat([cipher.update(framed), cipher.final()]);

    return Buffer.concat([iv, cipherText, cipher.getAuthTag()]).toString(
      'base64url',
    );
  };

  afterEach(() => jest.restoreAllMocks());

  it('round-trips plaintext under the matching mailbox and envelope', async () => {
    const body = await MailboxEnvelopeCipher.seal(
      envelopeKey,
      mailboxId,
      envelopeId,
      plaintext,
    );

    expect(
      Buffer.from(
        await MailboxEnvelopeCipher.open(
          envelopeKey,
          mailboxId,
          envelopeId,
          body,
        ),
      ).toString('utf8'),
    ).toBe('hello');
  });

  it('round-trips an empty plaintext', async () => {
    const body = await MailboxEnvelopeCipher.seal(
      envelopeKey,
      mailboxId,
      envelopeId,
      new Uint8Array(0),
    );

    expect(
      await MailboxEnvelopeCipher.open(
        envelopeKey,
        mailboxId,
        envelopeId,
        body,
      ),
    ).toHaveLength(0);
  });

  it.each([
    [0, 1024],
    [992, 1024],
    [993, 4096],
    [4064, 4096],
    [4065, 16384],
    [65504, 65536],
  ])(
    'pads %i plaintext bytes to a %i byte bucket',
    async (plaintextLength, bucket) => {
      const body = await MailboxEnvelopeCipher.seal(
        envelopeKey,
        mailboxId,
        envelopeId,
        new Uint8Array(plaintextLength).fill(1),
      );

      expect(decodedLength(body)).toBe(bucket);
    },
  );

  it('rejects plaintext larger than the largest bucket', async () => {
    await expect(
      MailboxEnvelopeCipher.seal(
        envelopeKey,
        mailboxId,
        envelopeId,
        new Uint8Array(65505),
      ),
    ).rejects.toThrow(MailboxEnvelopeError);
  });

  it('matches an independent AES-256-GCM decryption of the wire layout', async () => {
    const body = await MailboxEnvelopeCipher.seal(
      envelopeKey,
      mailboxId,
      envelopeId,
      plaintext,
    );
    const sealed = Buffer.from(body, 'base64url');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      envelopeKey,
      sealed.subarray(0, 12),
    );

    decipher.setAAD(Buffer.from(`${mailboxId}.${envelopeId}`));
    decipher.setAuthTag(sealed.subarray(sealed.length - 16));

    const framed = Buffer.concat([
      decipher.update(sealed.subarray(12, sealed.length - 16)),
      decipher.final(),
    ]);

    expect(framed.readUInt32BE(0)).toBe(plaintext.length);
    expect(framed.subarray(4, 4 + plaintext.length).toString('utf8')).toBe(
      'hello',
    );
  });

  it('opens a body sealed by an independent AES-256-GCM implementation', async () => {
    const framed = Buffer.alloc(1024 - 12 - 16);

    framed.writeUInt32BE(plaintext.length, 0);
    framed.set(plaintext, 4);

    expect(
      Buffer.from(
        await MailboxEnvelopeCipher.open(
          envelopeKey,
          mailboxId,
          envelopeId,
          sealWithNode(framed, `${mailboxId}.${envelopeId}`),
        ),
      ).toString('utf8'),
    ).toBe('hello');
  });

  it('seals and opens through WebCrypto AES-256-GCM', async () => {
    const importKey = jest.spyOn(crypto.subtle, 'importKey');
    const encrypt = jest.spyOn(crypto.subtle, 'encrypt');
    const decrypt = jest.spyOn(crypto.subtle, 'decrypt');
    const aad = new TextEncoder().encode(`${mailboxId}.${envelopeId}`);

    const body = await MailboxEnvelopeCipher.seal(
      envelopeKey,
      mailboxId,
      envelopeId,
      plaintext,
    );

    await MailboxEnvelopeCipher.open(envelopeKey, mailboxId, envelopeId, body);

    expect(importKey).toHaveBeenCalledWith(
      'raw',
      expect.objectContaining({ byteLength: 32 }),
      'AES-GCM',
      false,
      expect.arrayContaining(['encrypt', 'decrypt']),
    );
    for (const call of [encrypt, decrypt]) {
      expect(call).toHaveBeenCalledWith(
        expect.objectContaining({ additionalData: aad, name: 'AES-GCM' }),
        expect.anything(),
        expect.anything(),
      );
    }
  });

  it('rejects a tampered body', async () => {
    const body = await MailboxEnvelopeCipher.seal(
      envelopeKey,
      mailboxId,
      envelopeId,
      plaintext,
    );
    const tampered = `${body[0] === 'A' ? 'B' : 'A'}${body.slice(1)}`;

    await expect(
      MailboxEnvelopeCipher.open(envelopeKey, mailboxId, envelopeId, tampered),
    ).rejects.toThrow(
      new MailboxEnvelopeError('Envelope failed authentication'),
    );
  });

  it('rejects a body opened under another mailbox', async () => {
    const body = await MailboxEnvelopeCipher.seal(
      envelopeKey,
      mailboxId,
      envelopeId,
      plaintext,
    );

    await expect(
      MailboxEnvelopeCipher.open(
        envelopeKey,
        'other-mailbox',
        envelopeId,
        body,
      ),
    ).rejects.toThrow(MailboxEnvelopeError);
  });

  it('rejects a body relabelled with another envelope id', async () => {
    const body = await MailboxEnvelopeCipher.seal(
      envelopeKey,
      mailboxId,
      envelopeId,
      plaintext,
    );

    await expect(
      MailboxEnvelopeCipher.open(
        envelopeKey,
        mailboxId,
        'other-envelope-id-000000',
        body,
      ),
    ).rejects.toThrow(MailboxEnvelopeError);
  });

  it('rejects a body sealed under another key', async () => {
    const body = await MailboxEnvelopeCipher.seal(
      envelopeKey,
      mailboxId,
      envelopeId,
      plaintext,
    );

    await expect(
      MailboxEnvelopeCipher.open(
        new Uint8Array(32).fill(9),
        mailboxId,
        envelopeId,
        body,
      ),
    ).rejects.toThrow(MailboxEnvelopeError);
  });

  it('rejects a body that is not a bucket size', async () => {
    const body = await MailboxEnvelopeCipher.seal(
      envelopeKey,
      mailboxId,
      envelopeId,
      plaintext,
    );

    await expect(
      MailboxEnvelopeCipher.open(
        envelopeKey,
        mailboxId,
        envelopeId,
        body.slice(0, -4),
      ),
    ).rejects.toThrow(
      new MailboxEnvelopeError('Envelope body is not a bucket size'),
    );
  });

  it('rejects a body that is not base64url', async () => {
    await expect(
      MailboxEnvelopeCipher.open(
        envelopeKey,
        mailboxId,
        envelopeId,
        'not+base64url==',
      ),
    ).rejects.toThrow(
      new MailboxEnvelopeError('Envelope body is not base64url'),
    );
  });

  it('rejects an authentic frame whose length prefix overruns the block', async () => {
    const framed = Buffer.alloc(1024 - 12 - 16);

    framed.writeUInt32BE(99999, 0);

    await expect(
      MailboxEnvelopeCipher.open(
        envelopeKey,
        mailboxId,
        envelopeId,
        sealWithNode(framed, `${mailboxId}.${envelopeId}`),
      ),
    ).rejects.toThrow(
      new MailboxEnvelopeError('Envelope length prefix is invalid'),
    );
  });
});
