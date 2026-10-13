import { mock } from 'jest-mock-extended';

import type { PrivateBlobReference } from '../../../../../contexts/attachments/application/contracts/PrivateBlobReservation';

import { AttachmentBinaryCodec } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentBinaryCodec';
import { AttachmentCipher } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentCipher';
import { AttachmentLengthPadding } from '../../../../../contexts/attachments/infrastructure/crypto/AttachmentLengthPadding';
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

  const replicaBytes: Record<string, number[]> = {
    'alt-a': [4, 5],
    'blob-a': [1, 2],
    'blob-b': [3],
  };
  const replicatedA: PrivateBlobReference = {
    ...blobA,
    alternates: [
      {
        blobId: 'alt-a',
        downloadToken: 'token-alt-a-secret-0123456789',
        origin: 'https://node-b.example',
      },
    ],
    origin: 'https://node-a.example',
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

  it('shares the cache between references that differ only by origin', async () => {
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
    const attachment = (origin: string) => ({
      blobs: [{ ...blobA, origin }],
      contentType: 'text/plain',
      encryption: { algorithm: 'AES-GCM' as const, iv: 'iv', key: 'key' },
      filename: 'file.txt',
      size: 1,
    });

    await downloader.download(attachment('https://node-a.example'));
    await downloader.download(attachment('https://node-b.example'));

    expect(download).toHaveBeenCalledTimes(1);
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

  it('rejects an encrypted attachment without blobs as unavailable', async () => {
    const privateFiles = mock<PigeonPrivateFilesClient>();
    const publicFiles = mock<PigeonPublicFilesClient>();
    const privateBlobs = mock<PigeonPrivateBlobClient>();
    const cipher = mock<AttachmentCipher>();
    const downloader = new PigeonAttachmentDownloader(
      privateFiles,
      publicFiles,
      privateBlobs,
      cipher,
      new AttachmentBinaryCodec(),
    );

    await expect(
      downloader.download({
        cid: 'external-1',
        contentType: 'text/plain',
        encryption: { algorithm: 'AES-GCM' as const, iv: 'iv', key: 'key' },
        filename: 'file.txt',
        size: 3,
      }),
    ).rejects.toBeInstanceOf(PrivateBlobUnavailableError);
    expect(privateFiles.fetch).not.toHaveBeenCalled();
    expect(publicFiles.fetch).not.toHaveBeenCalled();
    expect(privateBlobs.download).not.toHaveBeenCalled();
    expect(cipher.decrypt).not.toHaveBeenCalled();
  });

  it('reads an alternate replica when the primary replica is missing', async () => {
    const download = jest
      .fn()
      .mockImplementation(({ blobId }: PrivateBlobReference) =>
        blobId === 'blob-a'
          ? Promise.reject(new PrivateBlobUnavailableError())
          : Promise.resolve(new Uint8Array(replicaBytes[blobId]).buffer),
      );
    const decrypted = new Blob(['secret'], { type: 'text/plain' });
    const cipher = {
      decrypt: jest.fn().mockResolvedValue(decrypted),
    } as unknown as AttachmentCipher;
    const downloader = new PigeonAttachmentDownloader(
      {} as PigeonPrivateFilesClient,
      {} as PigeonPublicFilesClient,
      { download } as unknown as PigeonPrivateBlobClient,
      cipher,
      new AttachmentBinaryCodec(),
    );
    const attachment = {
      blobs: [replicatedA],
      contentType: 'text/plain',
      encryption: { algorithm: 'AES-GCM' as const, iv: 'iv', key: 'key' },
      filename: 'file.txt',
      size: 2,
    };

    await expect(downloader.download(attachment)).resolves.toBe(decrypted);
    expect(download).toHaveBeenLastCalledWith({
      blobId: 'alt-a',
      downloadToken: 'token-alt-a-secret-0123456789',
      origin: 'https://node-b.example',
      size: 2,
    });
  });

  it('never fetches an alternate whose origin is not canonical', async () => {
    const download = jest
      .fn()
      .mockImplementation(({ blobId }: PrivateBlobReference) =>
        blobId === 'blob-a'
          ? Promise.reject(new PrivateBlobUnavailableError())
          : Promise.resolve(new Uint8Array(replicaBytes[blobId]).buffer),
      );
    const decrypted = new Blob(['secret'], { type: 'text/plain' });
    const cipher = {
      decrypt: jest.fn().mockResolvedValue(decrypted),
    } as unknown as AttachmentCipher;
    const downloader = new PigeonAttachmentDownloader(
      {} as PigeonPrivateFilesClient,
      {} as PigeonPublicFilesClient,
      { download } as unknown as PigeonPrivateBlobClient,
      cipher,
      new AttachmentBinaryCodec(),
    );
    const attachment = {
      blobs: [
        {
          ...blobA,
          alternates: [
            {
              blobId: 'alt-http',
              downloadToken: 'token-http-secret-0123456789',
              origin: 'http://node-b.example',
            },
            {
              blobId: 'alt-trailing',
              downloadToken: 'token-trailing-secret-0123456789',
              origin: 'https://node-c.example/',
            },
            {
              blobId: 'alt-a',
              downloadToken: 'token-alt-a-secret-0123456789',
              origin: 'https://node-d.example',
            },
          ],
          origin: 'https://node-a.example',
        },
      ],
      contentType: 'text/plain',
      encryption: { algorithm: 'AES-GCM' as const, iv: 'iv', key: 'key' },
      filename: 'file.txt',
      size: 2,
    };

    await expect(downloader.download(attachment)).resolves.toBe(decrypted);
    expect(
      download.mock.calls.map(([blob]: [PrivateBlobReference]) => blob.blobId),
    ).toEqual(['blob-a', 'alt-a']);
  });

  it('reports the attachment unavailable when every replica fails', async () => {
    const download = jest
      .fn()
      .mockRejectedValue(new PrivateBlobUnavailableError());
    const cipher = { decrypt: jest.fn() } as unknown as AttachmentCipher;
    const downloader = new PigeonAttachmentDownloader(
      {} as PigeonPrivateFilesClient,
      {} as PigeonPublicFilesClient,
      { download } as unknown as PigeonPrivateBlobClient,
      cipher,
      new AttachmentBinaryCodec(),
    );
    const attachment = {
      blobs: [replicatedA],
      contentType: 'text/plain',
      encryption: { algorithm: 'AES-GCM' as const, iv: 'iv', key: 'key' },
      filename: 'file.txt',
      size: 2,
    };

    await expect(downloader.download(attachment)).rejects.toBeInstanceOf(
      PrivateBlobUnavailableError,
    );
    expect(download).toHaveBeenCalledTimes(2);
    expect(cipher.decrypt).not.toHaveBeenCalled();
  });

  it('propagates a single replica error unchanged', async () => {
    const failure = new Error('socket closed');
    const download = jest.fn().mockRejectedValue(failure);
    const cipher = { decrypt: jest.fn() } as unknown as AttachmentCipher;
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
      size: 2,
    };

    await expect(downloader.download(attachment)).rejects.toBe(failure);
    expect(download).toHaveBeenCalledTimes(1);
    expect(cipher.decrypt).not.toHaveBeenCalled();
  });

  it('refetches only the aligned part that fails its own GCM check', async () => {
    const download = jest
      .fn()
      .mockImplementation(({ blobId }: PrivateBlobReference) =>
        Promise.resolve(new Uint8Array(replicaBytes[blobId]).buffer),
      );
    const decrypted = new Blob(['secret'], { type: 'text/plain' });
    const cipher = {
      decrypt: jest
        .fn()
        .mockRejectedValueOnce(new Error('GCM tag mismatch'))
        .mockResolvedValueOnce(decrypted),
      decryptWithoutWorker: jest.fn((_: unknown, bytes: ArrayBuffer) => {
        if (new Uint8Array(bytes)[0] === 1) {
          throw new Error('GCM tag mismatch');
        }

        return { bytes };
      }),
    } as unknown as AttachmentCipher;
    const downloader = new PigeonAttachmentDownloader(
      {} as PigeonPrivateFilesClient,
      {} as PigeonPublicFilesClient,
      { download } as unknown as PigeonPrivateBlobClient,
      cipher,
      new AttachmentBinaryCodec(),
    );
    const attachment = {
      blobs: [replicatedA, blobB],
      contentType: 'text/plain',
      encryption: {
        algorithm: 'AES-GCM' as const,
        chunks: [
          { iv: 'iv-a', size: 2 },
          { iv: 'iv-b', size: 1 },
        ],
        iv: 'iv',
        key: 'key',
        padding: AttachmentLengthPadding.marker,
      },
      filename: 'file.txt',
      size: 3,
    };

    await expect(downloader.download(attachment)).resolves.toBe(decrypted);
    expect(
      download.mock.calls.map(([blob]: [PrivateBlobReference]) => blob.blobId),
    ).toEqual(['blob-a', 'blob-b', 'alt-a']);
    const [, retried] = jest.mocked(cipher.decrypt).mock.calls[1];
    expect(Array.from(new Uint8Array(retried))).toEqual([4, 5, 3]);
    const [single] = jest.mocked(cipher.decryptWithoutWorker).mock.calls[0];
    expect(single.encryption).toEqual({
      algorithm: 'AES-GCM',
      chunks: [{ iv: 'iv-a', size: 2 }],
      iv: 'iv',
      key: 'key',
    });
    expect(single.encryption).not.toHaveProperty('padding');
  });

  it('retries unaligned parts whole, rotated by one, then reports unavailable', async () => {
    const download = jest
      .fn()
      .mockImplementation(({ blobId }: PrivateBlobReference) =>
        Promise.resolve(new Uint8Array(replicaBytes[blobId]).buffer),
      );
    const cipher = {
      decrypt: jest.fn().mockRejectedValue(new Error('GCM tag mismatch')),
      decryptWithoutWorker: jest.fn(),
    } as unknown as AttachmentCipher;
    const downloader = new PigeonAttachmentDownloader(
      {} as PigeonPrivateFilesClient,
      {} as PigeonPublicFilesClient,
      { download } as unknown as PigeonPrivateBlobClient,
      cipher,
      new AttachmentBinaryCodec(),
    );
    const attachment = {
      blobs: [replicatedA, blobB],
      contentType: 'text/plain',
      encryption: {
        algorithm: 'AES-GCM' as const,
        chunks: [{ iv: 'iv', size: 3 }],
        iv: 'iv',
        key: 'key',
      },
      filename: 'file.txt',
      size: 3,
    };

    await expect(downloader.download(attachment)).rejects.toBeInstanceOf(
      PrivateBlobUnavailableError,
    );
    expect(
      download.mock.calls.map(([blob]: [PrivateBlobReference]) => blob.blobId),
    ).toEqual(['blob-a', 'blob-b', 'alt-a', 'blob-b']);
    expect(cipher.decrypt).toHaveBeenCalledTimes(2);
    expect(cipher.decryptWithoutWorker).not.toHaveBeenCalled();
  });
});
