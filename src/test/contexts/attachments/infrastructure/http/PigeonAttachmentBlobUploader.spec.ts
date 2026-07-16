import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PigeonAttachmentBlobUploader } from '../../../../../contexts/attachments/infrastructure/http/PigeonAttachmentBlobUploader';
import { PigeonPrivateFilesClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonPrivateFilesClient';
import { PigeonPublicFilesClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonPublicFilesClient';

describe(PigeonAttachmentBlobUploader.name, () => {
  const session = { identity: { id: 'identity-1' } } as Session;

  it('uploads small encrypted byte payloads directly', async () => {
    const privateFiles = {
      upload: jest.fn().mockResolvedValue({
        cid: 'external-1',
        encrypted: true,
        size: 4,
      }),
    } as unknown as PigeonPrivateFilesClient;
    const uploader = new PigeonAttachmentBlobUploader(
      privateFiles,
      {} as PigeonPublicFilesClient,
    );

    await expect(
      uploader.uploadEncrypted(session, 'network-1', {
        encryptedBytes: new Uint8Array([1, 2, 3, 4]).buffer,
        metadata: {
          contentType: 'text/plain',
          filename: 'file.txt',
          size: 4,
        },
        uploadFilename: 'encrypted.bin',
      }),
    ).resolves.toEqual({ cid: 'external-1', size: 4 });
    expect(privateFiles.upload).toHaveBeenCalledWith(
      session,
      'network-1',
      expect.any(ArrayBuffer),
      'encrypted.bin',
    );
  });

  it('uploads small public files directly', async () => {
    const file = new File(['content'], 'file.txt', { type: 'text/plain' });
    const publicFiles = {
      upload: jest.fn().mockResolvedValue({
        cid: 'external-1',
        contentType: 'text/plain',
        filename: 'file.txt',
        size: file.size,
      }),
    } as unknown as PigeonPublicFilesClient;
    const uploader = new PigeonAttachmentBlobUploader(
      {} as PigeonPrivateFilesClient,
      publicFiles,
    );

    await expect(uploader.uploadPublic(session, file)).resolves.toEqual(
      expect.objectContaining({
        cid: 'external-1',
        encrypted: false,
        storage: 'public',
      }),
    );
  });
});
