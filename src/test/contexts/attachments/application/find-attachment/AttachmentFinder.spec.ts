import type { AttachmentRepository } from '../../../../../contexts/attachments/domain/repositories/AttachmentRepository';

import { AttachmentFinder } from '../../../../../contexts/attachments/application/find-attachment/AttachmentFinder';
import { FindAttachmentMessage } from '../../../../../contexts/attachments/application/find-attachment/messages/FindAttachmentMessage';
import { Attachment } from '../../../../../contexts/attachments/domain/Attachment';

describe(AttachmentFinder.name, () => {
  it('finds the aggregate through its domain repository', async () => {
    const repository: jest.Mocked<AttachmentRepository> = {
      create: jest.fn(),
      find: jest.fn(),
    };
    const attachment = Attachment.fromPrimitives({
      contentType: 'text/plain',
      externalIdentifier: 'external-1',
      filename: 'notes.txt',
      id: 'attachment-1',
      publication: { encrypted: false },
      size: 5,
      status: 'published',
    });
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
