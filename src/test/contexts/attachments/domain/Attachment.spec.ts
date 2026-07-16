import { Timestamp } from '@haskou/value-objects';

import { Attachment } from '../../../../contexts/attachments/domain/Attachment';
import { AttachmentPublicationPlan } from '../../../../contexts/attachments/domain/AttachmentPublicationPlan';
import { AttachmentByteSize } from '../../../../contexts/attachments/domain/value-objects/AttachmentByteSize';
import { AttachmentContentType } from '../../../../contexts/attachments/domain/value-objects/AttachmentContentType';
import { AttachmentExternalIdentifier } from '../../../../contexts/attachments/domain/value-objects/AttachmentExternalIdentifier';
import { AttachmentFilename } from '../../../../contexts/attachments/domain/value-objects/AttachmentFilename';
import { AttachmentId } from '../../../../contexts/attachments/domain/value-objects/AttachmentId';

describe(Attachment.name, () => {
  function plannedAttachment(): Attachment {
    return Attachment.plan(
      AttachmentId.fromString('attachment-1'),
      AttachmentFilename.fromString('photo.webp'),
      AttachmentContentType.fromString('image/webp'),
      AttachmentByteSize.fromBytes(2048),
      AttachmentPublicationPlan.public(),
      new Timestamp(100),
    );
  }

  it('records planning and publication as aggregate events', () => {
    const attachment = plannedAttachment();

    expect(attachment.isPublished()).toBe(false);
    expect(attachment.pullDomainEvents()).toEqual([
      expect.objectContaining({
        aggregateId: 'attachment-1',
        occurredAt: 100,
        type: 'AttachmentPublicationWasPlanned',
      }),
    ]);

    attachment.publish(
      AttachmentExternalIdentifier.fromString('external-1'),
      new Timestamp(200),
    );

    expect(attachment.isPublished()).toBe(true);
    expect(attachment.pullDomainEvents()).toEqual([
      expect.objectContaining({
        aggregateId: 'attachment-1',
        occurredAt: 200,
        type: 'AttachmentWasPublished',
      }),
    ]);
  });

  it('rejects publishing the same attachment twice', () => {
    const attachment = plannedAttachment();

    attachment.publish(
      AttachmentExternalIdentifier.fromString('external-1'),
      new Timestamp(200),
    );

    expect(() =>
      attachment.publish(
        AttachmentExternalIdentifier.fromString('external-2'),
        new Timestamp(300),
      ),
    ).toThrow('Attachment has already been published.');
  });
});
