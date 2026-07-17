import type { PendingMessageAttachment } from '../../../../../contexts/attachments/infrastructure/crypto/resources/PendingMessageAttachment';
import type {
  MessageAttachment,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { PigeonAttachmentBlobUploader } from '../../../../../contexts/attachments/infrastructure/http/PigeonAttachmentBlobUploader';

describe(PigeonAttachmentBlobUploader.name, () => {
  const session = { identity: { id: 'identity-1' } } as Session;
  const pending = {
    encryptedBytes: new Uint8Array([1, 2, 3, 4]).buffer,
    metadata: {
      contentType: 'text/plain',
      filename: 'file.txt',
      size: 4,
    },
    uploadFilename: 'encrypted.bin',
  };

  it('selects direct upload for small encrypted payloads', async () => {
    const direct = {
      uploadEncrypted: jest
        .fn()
        .mockResolvedValue({ cid: 'external-1', size: 4 }),
      uploadPublic: jest.fn(),
    };
    const chunked = { uploadEncrypted: jest.fn(), uploadPublic: jest.fn() };
    const uploader = new PigeonAttachmentBlobUploader(direct, chunked);

    await expect(
      uploader.uploadEncrypted(session, 'network-1', pending),
    ).resolves.toEqual({ cid: 'external-1', size: 4 });
    expect(direct.uploadEncrypted).toHaveBeenCalledWith(
      session,
      'network-1',
      pending,
      undefined,
    );
    expect(chunked.uploadEncrypted).not.toHaveBeenCalled();
  });

  it('selects direct upload for small public files', async () => {
    const file = new File(['content'], 'file.txt', { type: 'text/plain' });
    const attachment: MessageAttachment = {
      cid: 'external-1',
      contentType: 'text/plain',
      filename: 'file.txt',
      size: file.size,
    };
    const direct = {
      uploadEncrypted: jest.fn(),
      uploadPublic: jest.fn().mockResolvedValue(attachment),
    };
    const chunked = { uploadEncrypted: jest.fn(), uploadPublic: jest.fn() };
    const uploader = new PigeonAttachmentBlobUploader(direct, chunked);

    await expect(uploader.uploadPublic(session, file)).resolves.toBe(
      attachment,
    );
    expect(chunked.uploadPublic).not.toHaveBeenCalled();
  });

  it('selects chunked upload for large encrypted payloads', async () => {
    const largePending: PendingMessageAttachment = {
      ...pending,
      encryptedBytes: new ArrayBuffer(50 * 1024 * 1024 + 1),
    };
    const direct = { uploadEncrypted: jest.fn(), uploadPublic: jest.fn() };
    const chunked = {
      uploadEncrypted: jest
        .fn()
        .mockResolvedValue({ cid: 'chunk-1', size: 50 * 1024 * 1024 + 1 }),
      uploadPublic: jest.fn(),
    };
    const uploader = new PigeonAttachmentBlobUploader(direct, chunked);

    await uploader.uploadEncrypted(session, 'network-1', largePending);

    expect(chunked.uploadEncrypted).toHaveBeenCalled();
    expect(direct.uploadEncrypted).not.toHaveBeenCalled();
  });
});
