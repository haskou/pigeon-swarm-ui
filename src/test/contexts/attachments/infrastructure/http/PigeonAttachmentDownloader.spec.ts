import type { PrivateBlobReference } from '../../../../../contexts/attachments/application/contracts/PrivateBlobReservation';

import { AttachmentBinaryCodec } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentBinaryCodec';
import { AttachmentCipher } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentCipher';
import { attachmentBlobCacheKey } from '../../../../../contexts/attachments/infrastructure/http/attachmentBlobCacheKey';
import { PigeonAttachmentDownloader } from '../../../../../contexts/attachments/infrastructure/http/PigeonAttachmentDownloader';
import { PigeonPrivateBlobClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonPrivateBlobClient';
import { PigeonPrivateFilesClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonPrivateFilesClient';
import { PigeonPublicFilesClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonPublicFilesClient';
import { PrivateBlobUnavailableError } from '../../../../../contexts/attachments/infrastructure/http/PrivateBlobUnavailableError';

describe(PigeonAttachmentDownloader.name, () => {
  const blobA: PrivateBlobReference = {
    blobId: 'blob-a',
    downloadToken: 'token-a-secret-value-0123456789',
    expiresAt: 1,
    index: 0,
    size: 2,
  };
  const blobB: PrivateBlobReference = {
    blobId: 'blob-b',
    downloadToken: 'token-b-secret-value-0123456789',
    expiresAt: 2,
    index: 1,
    size: 1,
  };

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
      {} as PigeonPrivateBlobClient,
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

  it('downloads encrypted blobs in index order and decrypts their joined bytes', async () => {
    const download = jest
      .fn()
      .mockImplementation(({ blobId }: PrivateBlobReference) =>
        Promise.resolve(
          blobId === 'blob-a'
            ? new Uint8Array([1, 2]).buffer
            : new Uint8Array([3]).buffer,
        ),
      );
    const privateFiles = {
      fetch: jest.fn(),
    } as unknown as PigeonPrivateFilesClient;
    const decrypted = new Blob(['secret'], { type: 'text/plain' });
    const cipher = {
      decrypt: jest.fn().mockResolvedValue(decrypted),
    } as unknown as AttachmentCipher;
    const downloader = new PigeonAttachmentDownloader(
      privateFiles,
      {} as PigeonPublicFilesClient,
      { download } as unknown as PigeonPrivateBlobClient,
      cipher,
      new AttachmentBinaryCodec(),
    );
    const attachment = {
      blobs: [blobB, blobA],
      contentType: 'text/plain',
      encryption: { algorithm: 'AES-GCM' as const, iv: 'iv', key: 'key' },
      filename: 'file.txt',
      size: 3,
    };

    await expect(downloader.download(attachment)).resolves.toBe(decrypted);

    expect(
      download.mock.calls.map(([blob]: [PrivateBlobReference]) => blob.blobId),
    ).toEqual(['blob-a', 'blob-b']);
    expect(privateFiles.fetch).not.toHaveBeenCalled();
    const [, bytes] = jest.mocked(cipher.decrypt).mock.calls[0];
    expect(Array.from(new Uint8Array(bytes))).toEqual([1, 2, 3]);
  });

  it('downloads each encrypted blob once across repeated requests', async () => {
    const download = jest.fn().mockResolvedValue(new Uint8Array([9]).buffer);
    const cipher = {
      decrypt: jest.fn().mockResolvedValue(new Blob(['x'])),
    } as unknown as AttachmentCipher;
    const downloader = new PigeonAttachmentDownloader(
      {} as PigeonPrivateFilesClient,
      {} as PigeonPublicFilesClient,
      { download } as unknown as PigeonPrivateBlobClient,
      cipher,
      new AttachmentBinaryCodec(),
    );
    const attachment = {
      blobs: [blobA],
      contentType: 'text/plain',
      encryption: { algorithm: 'AES-GCM' as const, iv: 'iv', key: 'key' },
      filename: 'file.txt',
      size: 1,
    };

    await downloader.download(attachment);
    await downloader.download(attachment);

    expect(download).toHaveBeenCalledTimes(1);
    expect(cipher.decrypt).toHaveBeenCalledTimes(1);
  });

  it('surfaces an expired or missing blob as PrivateBlobUnavailableError', async () => {
    const download = jest
      .fn()
      .mockRejectedValue(new PrivateBlobUnavailableError());
    const downloader = new PigeonAttachmentDownloader(
      {} as PigeonPrivateFilesClient,
      {} as PigeonPublicFilesClient,
      { download } as unknown as PigeonPrivateBlobClient,
      {} as AttachmentCipher,
      new AttachmentBinaryCodec(),
    );

    await expect(
      downloader.download({
        blobs: [blobA],
        contentType: 'text/plain',
        encryption: { algorithm: 'AES-GCM' as const, iv: 'iv', key: 'key' },
        filename: 'file.txt',
        size: 2,
      }),
    ).rejects.toBeInstanceOf(PrivateBlobUnavailableError);
  });

  it('keys the cache by blob identifiers and never by download tokens', () => {
    const key = attachmentBlobCacheKey({
      blobs: [blobA],
      contentType: 'text/plain',
      filename: 'file.txt',
      size: 2,
    });

    expect(key).toContain('blob-a');
    expect(key).not.toContain(blobA.downloadToken);
  });

  it('downloads and decrypts legacy private content', async () => {
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
      {} as PigeonPrivateBlobClient,
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
