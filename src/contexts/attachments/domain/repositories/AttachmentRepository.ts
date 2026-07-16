import type { Attachment } from '../Attachment';
import type { PublicationStrategy } from '../strategies/PublicationStrategy';
import type { AttachmentExternalIdentifier } from '../value-objects/AttachmentExternalIdentifier';
import type { AttachmentPublisherExternalIdentifier } from '../value-objects/AttachmentPublisherExternalIdentifier';
import type { AttachmentSourceExternalIdentifier } from '../value-objects/AttachmentSourceExternalIdentifier';

export interface AttachmentRepository {
  create(
    attachment: Attachment,
    sourceExternalIdentifier: AttachmentSourceExternalIdentifier,
    publisherExternalIdentifier: AttachmentPublisherExternalIdentifier,
  ): Promise<AttachmentExternalIdentifier>;

  find(
    externalIdentifier: AttachmentExternalIdentifier,
    publication: PublicationStrategy,
  ): Promise<Attachment>;
}
