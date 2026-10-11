import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PigeonAttachmentPreviewCreator } from '../../../../../contexts/attachments/infrastructure/http/PigeonAttachmentPreviewCreator';

describe(PigeonAttachmentPreviewCreator.name, () => {
  const session = { identity: { id: 'identity-1' } } as Session;
  const source = new File(['source'], 'photo.png', { type: 'image/png' });
  const thumbnail = new File(['thumbnail'], 'photo.thumbnail.webp', {
    type: 'image/webp',
  });

  it('creates and encrypts a private preview', async () => {
    const pending = {
      encryptedBytes: new Uint8Array([1, 2, 3]).buffer,
      metadata: {
        contentType: 'image/webp',
        filename: 'photo.thumbnail.webp',
        size: thumbnail.size,
      },
    };
    const previewBlob = {
      blobId: 'preview-blob',
      downloadToken: 'preview-download-token-1',
      expiresAt: 1,
      index: 0,
      size: 3,
    };
    const cipher = { encrypt: jest.fn().mockResolvedValue(pending) };
    const blobs = {
      uploadEncrypted: jest
        .fn()
        .mockResolvedValue({ blobs: [previewBlob], size: 3 }),
      uploadPublic: jest.fn(),
    };
    const creator = new PigeonAttachmentPreviewCreator(cipher, blobs, {
      prepare: jest.fn().mockResolvedValue(thumbnail),
    });

    await expect(creator.createEncrypted(session, source)).resolves.toEqual({
      ...pending.metadata,
      blobs: [previewBlob],
      encrypted: true,
      encryptedSize: 3,
    });
    expect(blobs.uploadEncrypted).toHaveBeenCalledWith(session, pending);
  });

  it('omits an unavailable public preview without failing publication', async () => {
    const creator = new PigeonAttachmentPreviewCreator(
      { encrypt: jest.fn() },
      { uploadEncrypted: jest.fn(), uploadPublic: jest.fn() },
      { prepare: jest.fn().mockRejectedValue(new Error('unsupported')) },
    );

    await expect(
      creator.createPublic(session, source),
    ).resolves.toBeUndefined();
  });
});
