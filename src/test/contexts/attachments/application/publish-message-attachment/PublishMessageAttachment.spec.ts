import type { AttachmentPublisher } from '../../../../../contexts/attachments/application/publish-message-attachment/AttachmentPublisher';

import { PublishMessageAttachmentMessage } from '../../../../../contexts/attachments/application/publish-message-attachment/messages/PublishMessageAttachmentMessage';
import { PublishMessageAttachment } from '../../../../../contexts/attachments/application/publish-message-attachment/PublishMessageAttachment';
import { AttachmentExternalIdentifier } from '../../../../../contexts/attachments/domain/value-objects/AttachmentExternalIdentifier';

describe(PublishMessageAttachment.name, () => {
  it('publishes through the aggregate transaction boundary', async () => {
    const publisher: jest.Mocked<AttachmentPublisher> = {
      publish: jest
        .fn()
        .mockResolvedValue(
          AttachmentExternalIdentifier.fromString('external-1'),
        ),
    };
    const useCase = new PublishMessageAttachment(publisher);

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
    expect(attachment.getExternalIdentifier().toString()).toBe('external-1');
    expect(attachment.pullDomainEvents()).toEqual([
      expect.objectContaining({ type: 'AttachmentPublicationWasPlanned' }),
      expect.objectContaining({ type: 'AttachmentWasPublished' }),
    ]);
  });

  it('rejects encrypted publication without a network before infrastructure', async () => {
    const publisher: jest.Mocked<AttachmentPublisher> = {
      publish: jest.fn(),
    };
    const useCase = new PublishMessageAttachment(publisher);

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
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});
