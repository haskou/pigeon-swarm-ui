import type { Attachment } from '../Attachment';
import type { PublicationStrategy } from '../strategies/PublicationStrategy';
import type { AttachmentExternalIdentifier } from '../value-objects/AttachmentExternalIdentifier';

export interface AttachmentRepository {
  find(
    externalIdentifier: AttachmentExternalIdentifier,
    publication: PublicationStrategy,
  ): Promise<Attachment>;
}
