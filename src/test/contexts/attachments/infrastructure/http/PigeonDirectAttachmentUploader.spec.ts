import type { StoredPrivateBlobReplica } from '../../../../../contexts/attachments/infrastructure/http/PrivateBlobReplicator';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { PigeonDirectAttachmentUploader } from '../../../../../contexts/attachments/infrastructure/http/PigeonDirectAttachmentUploader';

describe(PigeonDirectAttachmentUploader.name, () => {
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

  it('stores encrypted bytes as one part through the replicator', async () => {
    const replicator = {
      storeParts: jest.fn().mockResolvedValue([[replica('blob-1')]]),
    };
    const uploader = new PigeonDirectAttachmentUploader(replicator, {
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
        [undefined],
      ),
    ).resolves.toEqual({
      blobs: [
        {
          blobId: 'blob-1',
          downloadToken: 'd'.repeat(43),
          expiresAt: 10,
          index: 0,
          size: 4,
        },
      ],
      size: 4,
    });
    expect(replicator.storeParts).toHaveBeenCalledWith(
      session,
      1,
      expect.any(Function),
      [undefined],
    );
    const partAt = replicator.storeParts.mock.calls[0][2] as (
      index: number,
    ) => ArrayBuffer;
    expect(partAt(0)).toBe(encryptedBytes);
    expect(progress).toHaveBeenLastCalledWith({
      filename: 'file.txt',
      percent: 100,
      phase: 'upload',
    });
  });

  it('records the primary origin and lists the other origins as alternates', async () => {
    const replicator = {
      storeParts: jest
        .fn()
        .mockResolvedValue([
          [
            replica('blob-1', 'https://node-a.example'),
            replica('blob-2', 'https://node-b.example'),
          ],
        ]),
    };
    const uploader = new PigeonDirectAttachmentUploader(replicator, {
      upload: jest.fn(),
    });

    const result = await uploader.uploadEncrypted(
      session,
      {
        encryptedBytes: new ArrayBuffer(4),
        metadata: { contentType: 'text/plain', filename: 'file.txt', size: 4 },
      },
      undefined,
      ['https://node-a.example', 'https://node-b.example'],
    );

    expect(replicator.storeParts).toHaveBeenCalledWith(
      session,
      1,
      expect.any(Function),
      ['https://node-a.example', 'https://node-b.example'],
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
      size: 4,
    });
  });

  it('omits the origin from the reference when the primary is on the session node', async () => {
    const replicator = {
      storeParts: jest.fn().mockResolvedValue([[replica('blob-1')]]),
    };
    const uploader = new PigeonDirectAttachmentUploader(replicator, {
      upload: jest.fn(),
    });

    const result = await uploader.uploadEncrypted(
      session,
      {
        encryptedBytes: new ArrayBuffer(4),
        metadata: { contentType: 'text/plain', filename: 'file.txt', size: 4 },
      },
      undefined,
      [undefined],
    );

    expect(result.blobs[0]).not.toHaveProperty('origin');
    expect(result.blobs[0]).not.toHaveProperty('alternates');
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
      { storeParts: jest.fn() },
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
