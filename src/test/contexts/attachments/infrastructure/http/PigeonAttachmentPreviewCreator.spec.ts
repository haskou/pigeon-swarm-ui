import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { AttachmentNetworkId } from '../../../../../contexts/attachments/domain/value-objects/AttachmentNetworkId';
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
      uploadFilename: 'encrypted-preview.bin',
    };
    const cipher = { encrypt: jest.fn().mockResolvedValue(pending) };
    const blobs = {
      uploadEncrypted: jest
        .fn()
        .mockResolvedValue({ cid: 'preview-1', size: 3 }),
      uploadPublic: jest.fn(),
    };
    const creator = new PigeonAttachmentPreviewCreator(cipher, blobs, {
      prepare: jest.fn().mockResolvedValue(thumbnail),
    });

    await expect(
      creator.createEncrypted(
        session,
        AttachmentNetworkId.fromString('network-1'),
        source,
      ),
    ).resolves.toEqual({
      ...pending.metadata,
      cid: 'preview-1',
      encrypted: true,
      encryptedSize: 3,
    });
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
