import type { AttachmentRepository } from '../../../../../contexts/attachments/domain/repositories/AttachmentRepository';

import { PublishMessageAttachmentMessage } from '../../../../../contexts/attachments/application/publish-message-attachment/messages/PublishMessageAttachmentMessage';
import { PublishMessageAttachment } from '../../../../../contexts/attachments/application/publish-message-attachment/PublishMessageAttachment';
import { AttachmentExternalIdentifier } from '../../../../../contexts/attachments/domain/value-objects/AttachmentExternalIdentifier';

describe(PublishMessageAttachment.name, () => {
  it('publishes through the aggregate transaction boundary', async () => {
    const attachments: jest.Mocked<AttachmentRepository> = {
      create: jest
        .fn()
        .mockResolvedValue(
          AttachmentExternalIdentifier.fromString('external-1'),
        ),
      find: jest.fn(),
    };
    const useCase = new PublishMessageAttachment(attachments);

    const attachment = await useCase.publish(
      new PublishMessageAttachmentMessage({
        contentType: 'text/plain',
        encryptLargeAttachments: false,
        encryptSmallAttachments: false,
        filename: 'notes.txt',
        id: 'attachment-1',
        occurredAt: 100,
        publisherExternalIdentifier: 'identity-1',
        size: 5,
        sourceExternalIdentifier: 'source-1',
      }),
    );

    expect(attachment.isPublished()).toBe(true);
    expect(attachment.getPublishedExternalIdentifier().toString()).toBe(
      'external-1',
    );
    expect(attachment.pullDomainEvents()).toEqual([
      expect.objectContaining({ type: 'AttachmentPublicationWasPlanned' }),
      expect.objectContaining({ type: 'AttachmentWasPublished' }),
    ]);
  });

  it('rejects encrypted publication without a network before infrastructure', async () => {
    const attachments: jest.Mocked<AttachmentRepository> = {
      create: jest.fn(),
      find: jest.fn(),
    };
    const useCase = new PublishMessageAttachment(attachments);

    await expect(
      useCase.publish(
        new PublishMessageAttachmentMessage({
          contentType: 'text/plain',
          filename: 'notes.txt',
          id: 'attachment-1',
          occurredAt: 100,
          publisherExternalIdentifier: 'identity-1',
          size: 5,
          sourceExternalIdentifier: 'source-1',
        }),
      ),
    ).rejects.toThrow('Encrypted attachment publication requires a network.');
    expect(attachments.create).not.toHaveBeenCalled();
  });
});
