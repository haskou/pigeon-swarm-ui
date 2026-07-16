import { AttachmentCipher } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentCipher';

describe(AttachmentCipher.name, () => {
  it('converts base64 values to exact array buffers', () => {
    const cipher = AttachmentCipher.inCurrentThread();
    const bytes = new Uint8Array(cipher.base64ToArrayBuffer('AQID'));

    expect([...bytes]).toEqual([1, 2, 3]);
  });

  it('encrypts and decrypts attachment bytes', async () => {
    const cipher = AttachmentCipher.inCurrentThread();
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const encrypted = await cipher.encrypt(file);
    const blob = await cipher.decrypt(
      {
        ...encrypted.metadata,
        cid: 'cid',
        encryptedSize: encrypted.encryptedBytes.byteLength,
      },
      encrypted.encryptedBytes,
    );

    await expect(blob.text()).resolves.toBe('hello');
    expect(encrypted.metadata.encryption?.chunks?.length).toBeGreaterThan(0);
  });
});
