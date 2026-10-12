import type { PendingMessageAttachment } from '../../../../../contexts/attachments/infrastructure/crypto/resources/PendingMessageAttachment';
import type { StoredPrivateBlobReplica } from '../../../../../contexts/attachments/infrastructure/http/PrivateBlobReplicator';
import type {
  MessageAttachmentEncryption,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { PigeonChunkedAttachmentUploader } from '../../../../../contexts/attachments/infrastructure/http/PigeonChunkedAttachmentUploader';

const mebibyte = 1024 * 1024;

describe(PigeonChunkedAttachmentUploader.name, () => {
  const session = { identity: { id: 'identity-1' } } as Session;
  const replica = (
    blobId: string,
    origin?: string,
  ): StoredPrivateBlobReplica => ({
    blobId,
    downloadToken: 'd'.repeat(43),
    expiresAt: 10,
    ...(origin === undefined ? {} : { origin }),
    uploadToken: 'u'.repeat(43),
  });
  const pendingOf = (
    encryptedBytes: ArrayBuffer,
    encryption?: MessageAttachmentEncryption,
  ): PendingMessageAttachment => ({
    encryptedBytes,
    metadata: {
      contentType: 'text/plain',
      filename: 'file.txt',
      size: encryptedBytes.byteLength,
      ...(encryption === undefined ? {} : { encryption }),
    },
  });

  it('stores each part through the replicator, in order, with 8 MiB cuts', async () => {
    const replicator = {
      abandon: jest.fn(),
      storeParts: jest
        .fn()
        .mockResolvedValueOnce([[replica('blob-1')]])
        .mockResolvedValueOnce([[replica('blob-2')]]),
    };
    const uploader = new PigeonChunkedAttachmentUploader(replicator, {
      upload: jest.fn(),
    });

    const result = await uploader.uploadEncrypted(
      session,
      pendingOf(new ArrayBuffer(8 * mebibyte + 1)),
      undefined,
      [undefined],
    );

    expect(replicator.storeParts).toHaveBeenNthCalledWith(
      1,
      session,
      1,
      expect.any(Function),
      [undefined],
    );
    expect(replicator.storeParts).toHaveBeenNthCalledWith(
      2,
      session,
      1,
      expect.any(Function),
      [undefined],
    );
    const parts = replicator.storeParts.mock.calls.map(([, , partAt]) =>
      (partAt as (index: number) => ArrayBuffer)(0),
    );
    expect(parts.map((part) => part.byteLength)).toEqual([8 * mebibyte, 1]);
    expect(result).toEqual({
      blobs: [
        {
          blobId: 'blob-1',
          downloadToken: 'd'.repeat(43),
          expiresAt: 10,
          index: 0,
          size: 8 * mebibyte,
        },
        {
          blobId: 'blob-2',
          downloadToken: 'd'.repeat(43),
          expiresAt: 10,
          index: 1,
          size: 1,
        },
      ],
      size: 8 * mebibyte + 1,
      type: 'chunked_file',
    });
  });

  it('cuts parts at the encryption chunk sizes when the metadata has them', async () => {
    const replicator = {
      abandon: jest.fn(),
      storeParts: jest
        .fn()
        .mockResolvedValueOnce([[replica('blob-1')]])
        .mockResolvedValueOnce([[replica('blob-2')]]),
    };
    const uploader = new PigeonChunkedAttachmentUploader(replicator, {
      upload: jest.fn(),
    });
    const encryption: MessageAttachmentEncryption = {
      algorithm: 'AES-GCM',
      chunks: [
        { iv: 'iv', size: 3 },
        { iv: 'iv', size: 2 },
      ],
      chunkSize: 8,
      iv: 'iv',
      key: 'key',
    };

    const result = await uploader.uploadEncrypted(
      session,
      pendingOf(new Uint8Array([1, 2, 3, 4, 5]).buffer, encryption),
      undefined,
      [undefined],
    );

    const parts = replicator.storeParts.mock.calls.map(([, , partAt]) =>
      Array.from(new Uint8Array((partAt as (index: number) => ArrayBuffer)(0))),
    );
    expect(parts).toEqual([
      [1, 2, 3],
      [4, 5],
    ]);
    expect(result.blobs.map((blob) => blob.size)).toEqual([3, 2]);
  });

  it('forwards the origins to every part and keeps alternates on each reference', async () => {
    const origins = ['https://node-a.example', 'https://node-b.example'];
    const replicator = {
      abandon: jest.fn(),
      storeParts: jest
        .fn()
        .mockResolvedValueOnce([
          [
            replica('blob-1', 'https://node-a.example'),
            replica('blob-2', 'https://node-b.example'),
          ],
        ])
        .mockResolvedValueOnce([
          [
            replica('blob-3', 'https://node-a.example'),
            replica('blob-4', 'https://node-b.example'),
          ],
        ]),
    };
    const uploader = new PigeonChunkedAttachmentUploader(replicator, {
      upload: jest.fn(),
    });

    const result = await uploader.uploadEncrypted(
      session,
      pendingOf(new ArrayBuffer(8 * mebibyte + 1)),
      undefined,
      origins,
    );

    expect(replicator.storeParts).toHaveBeenNthCalledWith(
      1,
      session,
      1,
      expect.any(Function),
      origins,
    );
    expect(replicator.storeParts).toHaveBeenNthCalledWith(
      2,
      session,
      1,
      expect.any(Function),
      origins,
    );
    expect(result.blobs[0]).toEqual({
      alternates: [
        {
          blobId: 'blob-2',
          downloadToken: 'd'.repeat(43),
          origin: 'https://node-b.example',
        },
      ],
      blobId: 'blob-1',
      downloadToken: 'd'.repeat(43),
      expiresAt: 10,
      index: 0,
      origin: 'https://node-a.example',
      size: 8 * mebibyte,
    });
  });

  it('abandons every replica stored so far and rethrows when a later part fails', async () => {
    const failure = new Error('part failed');
    const replicator = {
      abandon: jest.fn().mockResolvedValue(undefined),
      storeParts: jest
        .fn()
        .mockResolvedValueOnce([
          [
            replica('blob-1', 'https://node-a.example'),
            replica('blob-2', 'https://node-b.example'),
          ],
        ])
        .mockResolvedValueOnce([[replica('blob-3')]])
        .mockRejectedValueOnce(failure),
    };
    const uploader = new PigeonChunkedAttachmentUploader(replicator, {
      upload: jest.fn(),
    });

    await expect(
      uploader.uploadEncrypted(
        session,
        pendingOf(new ArrayBuffer(16 * mebibyte + 1)),
        undefined,
        [undefined],
      ),
    ).rejects.toBe(failure);
    expect(replicator.abandon).toHaveBeenCalledWith(session, [
      replica('blob-1', 'https://node-a.example'),
      replica('blob-2', 'https://node-b.example'),
      replica('blob-3'),
    ]);
  });

  it('abandons nothing extra when the first part fails', async () => {
    const failure = new Error('part failed');
    const replicator = {
      abandon: jest.fn().mockResolvedValue(undefined),
      storeParts: jest.fn().mockRejectedValue(failure),
    };
    const uploader = new PigeonChunkedAttachmentUploader(replicator, {
      upload: jest.fn(),
    });

    await expect(
      uploader.uploadEncrypted(
        session,
        pendingOf(new ArrayBuffer(4)),
        undefined,
        [undefined],
      ),
    ).rejects.toBe(failure);
    expect(replicator.abandon).toHaveBeenCalledWith(session, []);
  });

  it('uploads public files as verifiable chunks', async () => {
    const file = new File(['content'], 'file.txt', { type: 'text/plain' });
    const publicFiles = {
      upload: jest.fn().mockResolvedValue({
        cid: 'public-1',
        contentType: 'application/octet-stream',
        filename: 'file.txt.part-0000',
        size: file.size,
      }),
    };
    const uploader = new PigeonChunkedAttachmentUploader(
      { abandon: jest.fn(), storeParts: jest.fn() },
      publicFiles,
    );

    await expect(uploader.uploadPublic(session, file)).resolves.toEqual(
      expect.objectContaining({
        cid: 'public-1',
        contentType: 'text/plain',
        encrypted: false,
        filename: 'file.txt',
        storage: 'public',
        type: 'chunked_file',
      }),
    );
  });
});
