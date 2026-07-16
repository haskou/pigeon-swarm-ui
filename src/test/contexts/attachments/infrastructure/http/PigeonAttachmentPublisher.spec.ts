import { Timestamp } from '@haskou/value-objects';

import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { Attachment } from '../../../../../contexts/attachments/domain/Attachment';
import { AttachmentPublicationPlan } from '../../../../../contexts/attachments/domain/AttachmentPublicationPlan';
import { AttachmentByteSize } from '../../../../../contexts/attachments/domain/value-objects/AttachmentByteSize';
import { AttachmentContentType } from '../../../../../contexts/attachments/domain/value-objects/AttachmentContentType';
import { AttachmentFilename } from '../../../../../contexts/attachments/domain/value-objects/AttachmentFilename';
import { AttachmentId } from '../../../../../contexts/attachments/domain/value-objects/AttachmentId';
import { AttachmentPublisherExternalIdentifier } from '../../../../../contexts/attachments/domain/value-objects/AttachmentPublisherExternalIdentifier';
import { AttachmentSourceExternalIdentifier } from '../../../../../contexts/attachments/domain/value-objects/AttachmentSourceExternalIdentifier';
import { AttachmentPublicationContexts } from '../../../../../contexts/attachments/infrastructure/http/AttachmentPublicationContexts';
import { PigeonAttachmentPublisher } from '../../../../../contexts/attachments/infrastructure/http/PigeonAttachmentPublisher';

describe(PigeonAttachmentPublisher.name, () => {
  it('publishes a public aggregate using its registered browser source', async () => {
    const file = new File(['content'], 'file.txt', { type: 'text/plain' });
    const session = { identity: { id: 'identity-1' } } as Session;
    const contexts = new AttachmentPublicationContexts();
    const uploader = {
      publishEncrypted: jest.fn(),
      publishPublic: jest.fn().mockResolvedValue({
        cid: 'external-1',
        contentType: 'text/plain',
        filename: 'file.txt',
        size: file.size,
      }),
    };
    const publisher = new PigeonAttachmentPublisher(uploader, contexts);

    contexts.register('source-1', 'identity-1', { file, session });

    const result = await publisher.publish(
      Attachment.plan(
        AttachmentId.fromString('attachment-1'),
        AttachmentFilename.fromString('file.txt'),
        AttachmentContentType.fromString('text/plain'),
        AttachmentByteSize.fromBytes(file.size),
        AttachmentPublicationPlan.public(),
        new Timestamp(100),
      ),
      AttachmentSourceExternalIdentifier.fromString('source-1'),
      AttachmentPublisherExternalIdentifier.fromString('identity-1'),
    );

    expect(result.toString()).toBe('external-1');
    expect(contexts.takePublished('source-1')).toEqual(
      expect.objectContaining({ cid: 'external-1' }),
    );
    expect(uploader.publishPublic).toHaveBeenCalledWith(
      session,
      file,
      undefined,
    );
  });
});
