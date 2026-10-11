import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PigeonChunkedAttachmentUploader } from '../../../../../contexts/attachments/infrastructure/http/PigeonChunkedAttachmentUploader';

const mebibyte = 1024 * 1024;

describe(PigeonChunkedAttachmentUploader.name, () => {
  const session = { identity: { id: 'identity-1' } } as Session;
  const reservation = (blobId: string) => ({
    blobId,
    downloadToken: 'd'.repeat(43),
    expiresAt: 10,
    uploadToken: 'u'.repeat(43),
  });

  it('stores each encrypted part in its own private blob, in order', async () => {
    const privateBlobs = {
      reserve: jest
        .fn()
        .mockResolvedValueOnce(reservation('blob-1'))
        .mockResolvedValueOnce(reservation('blob-2')),
      upload: jest.fn().mockResolvedValue(undefined),
    };
    const uploader = new PigeonChunkedAttachmentUploader(privateBlobs, {
      upload: jest.fn(),
    });

    const result = await uploader.uploadEncrypted(session, {
      encryptedBytes: new ArrayBuffer(8 * mebibyte + 1),
      metadata: {
        contentType: 'text/plain',
        filename: 'file.txt',
        size: 8 * mebibyte + 1,
      },
    });

    expect(privateBlobs.reserve).toHaveBeenNthCalledWith(
      1,
      session,
      8 * mebibyte,
    );
    expect(privateBlobs.reserve).toHaveBeenNthCalledWith(2, session, 1);
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
    expect(privateBlobs.upload).toHaveBeenNthCalledWith(
      1,
      reservation('blob-1'),
      expect.any(ArrayBuffer),
    );
    expect(privateBlobs.upload).toHaveBeenNthCalledWith(
      2,
      reservation('blob-2'),
      expect.any(ArrayBuffer),
    );
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
      { reserve: jest.fn(), upload: jest.fn() },
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
