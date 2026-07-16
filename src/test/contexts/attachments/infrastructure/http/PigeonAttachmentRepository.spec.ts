import { EncryptedAttachmentStrategy } from '../../../../../contexts/attachments/domain/strategies/EncryptedAttachmentStrategy';
import { PublicAttachmentStrategy } from '../../../../../contexts/attachments/domain/strategies/PublicAttachmentStrategy';
import { AttachmentExternalIdentifier } from '../../../../../contexts/attachments/domain/value-objects/AttachmentExternalIdentifier';
import { PigeonAttachmentRepository } from '../../../../../contexts/attachments/infrastructure/http/PigeonAttachmentRepository';

describe(PigeonAttachmentRepository.name, () => {
  it('hydrates a public attachment aggregate', async () => {
    const findPublic = jest.fn().mockResolvedValue({
      blob: new Blob(['notes']),
      cid: 'public-1',
      contentType: 'text/plain',
      filename: 'notes.txt',
      size: 5,
    });
    const repository = new PigeonAttachmentRepository({
      findPrivate: jest.fn(),
      findPublic,
    });

    const attachment = await repository.find(
      AttachmentExternalIdentifier.fromString('public-1'),
      PublicAttachmentStrategy.create(),
    );

    expect(attachment.isPublished()).toBe(true);
    expect(attachment.isEncrypted()).toBe(false);
    expect(findPublic).toHaveBeenCalledWith('public-1');
  });

  it('hydrates an encrypted attachment aggregate', async () => {
    const findPrivate = jest.fn().mockResolvedValue({
      cid: 'private-1',
      contentType: 'application/octet-stream',
      encrypted: true,
      encryptedData: 'AQID',
      filename: 'archive.bin',
      size: 3,
    });
    const repository = new PigeonAttachmentRepository({
      findPrivate,
      findPublic: jest.fn(),
    });

    const attachment = await repository.find(
      AttachmentExternalIdentifier.fromString('private-1'),
      EncryptedAttachmentStrategy.restore(),
    );

    expect(attachment.isPublished()).toBe(true);
    expect(attachment.isEncrypted()).toBe(true);
    expect(findPrivate).toHaveBeenCalledWith('private-1');
  });
});
