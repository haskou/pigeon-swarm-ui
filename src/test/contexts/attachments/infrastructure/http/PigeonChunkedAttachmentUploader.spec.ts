import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PigeonChunkedAttachmentUploader } from '../../../../../contexts/attachments/infrastructure/http/PigeonChunkedAttachmentUploader';

describe(PigeonChunkedAttachmentUploader.name, () => {
  const session = { identity: { id: 'identity-1' } } as Session;

  it('uploads encrypted content as verifiable chunks', async () => {
    const privateFiles = {
      upload: jest.fn().mockResolvedValue({ cid: 'private-1', size: 4 }),
    };
    const uploader = new PigeonChunkedAttachmentUploader(privateFiles, {
      upload: jest.fn(),
    });

    const result = await uploader.uploadEncrypted(session, 'network-1', {
      encryptedBytes: new Uint8Array([1, 2, 3, 4]).buffer,
      metadata: {
        contentType: 'text/plain',
        filename: 'file.txt',
        size: 4,
      },
      uploadFilename: 'encrypted.bin',
    });

    expect(result).toEqual(
      expect.objectContaining({
        cid: 'private-1',
        type: 'chunked_file',
      }),
    );
    expect(result.chunks?.[0]).toEqual(
      expect.objectContaining({ cid: 'private-1', index: 0, size: 4 }),
    );
    expect(result.chunks?.[0].sha256).toHaveLength(64);
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
      { upload: jest.fn() },
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
