import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PigeonDirectAttachmentUploader } from '../../../../../contexts/attachments/infrastructure/http/PigeonDirectAttachmentUploader';

describe(PigeonDirectAttachmentUploader.name, () => {
  const session = { identity: { id: 'identity-1' } } as Session;
  const reservation = {
    blobId: 'blob-1',
    downloadToken: 'd'.repeat(43),
    expiresAt: 10,
    uploadToken: 'u'.repeat(43),
  };

  it('stores encrypted bytes in one private blob reserved for their exact size', async () => {
    const privateBlobs = {
      reserve: jest.fn().mockResolvedValue(reservation),
      upload: jest.fn().mockResolvedValue(undefined),
    };
    const uploader = new PigeonDirectAttachmentUploader(privateBlobs, {
      upload: jest.fn(),
    });
    const progress = jest.fn();
    const encryptedBytes = new Uint8Array([1, 2, 3, 4]).buffer;

    await expect(
      uploader.uploadEncrypted(
        session,
        {
          encryptedBytes,
          metadata: {
            contentType: 'text/plain',
            filename: 'file.txt',
            size: 4,
          },
        },
        progress,
      ),
    ).resolves.toEqual({
      blobs: [
        {
          blobId: 'blob-1',
          downloadToken: reservation.downloadToken,
          expiresAt: 10,
          index: 0,
          size: 4,
        },
      ],
      size: 4,
    });
    expect(privateBlobs.reserve).toHaveBeenCalledWith(session, 4);
    expect(privateBlobs.upload).toHaveBeenCalledWith(
      reservation,
      encryptedBytes,
    );
    expect(progress).toHaveBeenLastCalledWith({
      filename: 'file.txt',
      percent: 100,
      phase: 'upload',
    });
  });

  it('uploads public files directly', async () => {
    const file = new File(['content'], 'file.txt', { type: 'text/plain' });
    const publicFiles = {
      upload: jest.fn().mockResolvedValue({
        cid: 'public-1',
        contentType: 'text/plain',
        filename: 'file.txt',
        size: file.size,
      }),
    };
    const uploader = new PigeonDirectAttachmentUploader(
      { reserve: jest.fn(), upload: jest.fn() },
      publicFiles,
    );

    await expect(uploader.uploadPublic(session, file)).resolves.toEqual({
      cid: 'public-1',
      contentType: 'text/plain',
      encrypted: false,
      filename: 'file.txt',
      size: file.size,
      storage: 'public',
    });
  });
});
