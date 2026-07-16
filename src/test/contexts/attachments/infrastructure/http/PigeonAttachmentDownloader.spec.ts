import { AttachmentBinaryCodec } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentBinaryCodec';
import { AttachmentCipher } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentCipher';
import { PigeonAttachmentDownloader } from '../../../../../contexts/attachments/infrastructure/http/PigeonAttachmentDownloader';
import { PigeonPrivateFilesClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonPrivateFilesClient';
import { PigeonPublicFilesClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonPublicFilesClient';

describe(PigeonAttachmentDownloader.name, () => {
  it('downloads public content once and caches the resulting blob', async () => {
    const blob = new Blob(['public'], { type: 'text/plain' });
    const publicFiles = {
      fetch: jest.fn().mockResolvedValue({
        blob,
        cid: 'external-1',
        contentType: 'text/plain',
        filename: 'file.txt',
        size: blob.size,
      }),
    } as unknown as PigeonPublicFilesClient;
    const downloader = new PigeonAttachmentDownloader(
      {} as PigeonPrivateFilesClient,
      publicFiles,
      {} as AttachmentCipher,
      new AttachmentBinaryCodec(),
    );
    const attachment = {
      cid: 'external-1',
      contentType: 'text/plain',
      encrypted: false,
      filename: 'file.txt',
      size: blob.size,
    };

    await expect(downloader.download(attachment)).resolves.toBe(blob);
    await expect(downloader.download(attachment)).resolves.toBe(blob);
    expect(publicFiles.fetch).toHaveBeenCalledTimes(1);
  });

  it('downloads and decrypts private content', async () => {
    const decrypted = new Blob(['private'], { type: 'text/plain' });
    const privateFiles = {
      fetch: jest.fn().mockResolvedValue({
        cid: 'external-1',
        contentType: 'application/octet-stream',
        encrypted: true,
        encryptedData: 'AQID',
        filename: 'encrypted.bin',
        size: 3,
      }),
    } as unknown as PigeonPrivateFilesClient;
    const cipher = {
      decrypt: jest.fn().mockResolvedValue(decrypted),
    } as unknown as AttachmentCipher;
    const downloader = new PigeonAttachmentDownloader(
      privateFiles,
      {} as PigeonPublicFilesClient,
      cipher,
      new AttachmentBinaryCodec(),
    );
    const attachment = {
      cid: 'external-1',
      contentType: 'text/plain',
      encryption: {
        algorithm: 'AES-GCM' as const,
        iv: 'iv',
        key: 'key',
      },
      filename: 'file.txt',
      size: 3,
    };

    await expect(downloader.download(attachment)).resolves.toBe(decrypted);
    expect(cipher.decrypt).toHaveBeenCalledWith(
      attachment,
      expect.any(ArrayBuffer),
      undefined,
    );
  });
});
