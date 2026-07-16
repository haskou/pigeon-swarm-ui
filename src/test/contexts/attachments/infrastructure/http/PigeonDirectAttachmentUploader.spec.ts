import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PigeonDirectAttachmentUploader } from '../../../../../contexts/attachments/infrastructure/http/PigeonDirectAttachmentUploader';

describe(PigeonDirectAttachmentUploader.name, () => {
  const session = { identity: { id: 'identity-1' } } as Session;

  it('uploads encrypted bytes directly', async () => {
    const privateFiles = {
      upload: jest.fn().mockResolvedValue({ cid: 'private-1', size: 4 }),
    };
    const uploader = new PigeonDirectAttachmentUploader(privateFiles, {
      upload: jest.fn(),
    });
    const progress = jest.fn();

    await expect(
      uploader.uploadEncrypted(
        session,
        'network-1',
        {
          encryptedBytes: new Uint8Array([1, 2, 3, 4]).buffer,
          metadata: {
            contentType: 'text/plain',
            filename: 'file.txt',
            size: 4,
          },
          uploadFilename: 'encrypted.bin',
        },
        progress,
      ),
    ).resolves.toEqual({ cid: 'private-1', size: 4 });
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
      { upload: jest.fn() },
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
