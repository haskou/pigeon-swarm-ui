import type { AttachmentRepository } from '../../../../../contexts/attachments/domain/repositories/AttachmentRepository';

import { AttachmentFinder } from '../../../../../contexts/attachments/application/find-attachment/AttachmentFinder';
import { FindAttachmentMessage } from '../../../../../contexts/attachments/application/find-attachment/messages/FindAttachmentMessage';
import { Attachment } from '../../../../../contexts/attachments/domain/Attachment';
import { PublicAttachmentStrategy } from '../../../../../contexts/attachments/domain/strategies/PublicAttachmentStrategy';
import { AttachmentByteSize } from '../../../../../contexts/attachments/domain/value-objects/AttachmentByteSize';
import { AttachmentContentType } from '../../../../../contexts/attachments/domain/value-objects/AttachmentContentType';
import { AttachmentExternalIdentifier } from '../../../../../contexts/attachments/domain/value-objects/AttachmentExternalIdentifier';
import { AttachmentFilename } from '../../../../../contexts/attachments/domain/value-objects/AttachmentFilename';
import { AttachmentId } from '../../../../../contexts/attachments/domain/value-objects/AttachmentId';

describe(AttachmentFinder.name, () => {
  it('finds the aggregate through its domain repository', async () => {
    const repository: jest.Mocked<AttachmentRepository> = {
      create: jest.fn(),
      find: jest.fn(),
    };
    const attachment = Attachment.restorePublished(
      AttachmentId.fromString('attachment-1'),
      AttachmentFilename.fromString('notes.txt'),
      AttachmentContentType.fromString('text/plain'),
      AttachmentByteSize.fromBytes(5),
      PublicAttachmentStrategy.create(),
      AttachmentExternalIdentifier.fromString('external-1'),
    );
    repository.find.mockResolvedValue(attachment);
    const finder = new AttachmentFinder(repository);

    await expect(
      finder.find(new FindAttachmentMessage('external-1', false)),
    ).resolves.toBe(attachment);

    const [externalIdentifier, publication] = repository.find.mock.calls[0];
    expect(externalIdentifier.toString()).toBe('external-1');
    expect(publication.isEncrypted()).toBe(false);
  });
});
