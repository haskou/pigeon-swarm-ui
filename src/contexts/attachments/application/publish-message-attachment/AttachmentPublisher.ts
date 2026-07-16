import { Attachment } from '../../domain/Attachment';
import { AttachmentExternalIdentifier } from '../../domain/value-objects/AttachmentExternalIdentifier';
import { AttachmentPublisherExternalIdentifier } from '../../domain/value-objects/AttachmentPublisherExternalIdentifier';
import { AttachmentSourceExternalIdentifier } from '../../domain/value-objects/AttachmentSourceExternalIdentifier';

export interface AttachmentPublisher {
  publish(
    attachment: Attachment,
    sourceExternalIdentifier: AttachmentSourceExternalIdentifier,
    publisherExternalIdentifier: AttachmentPublisherExternalIdentifier,
  ): Promise<AttachmentExternalIdentifier>;
}
