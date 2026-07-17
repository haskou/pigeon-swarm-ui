import { AttachmentBinaryCodec } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentBinaryCodec';
import { AttachmentCryptographer } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentCryptographer';

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
});
