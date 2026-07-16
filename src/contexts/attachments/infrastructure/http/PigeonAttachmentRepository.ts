import type { AttachmentRepository } from '../../domain/repositories/AttachmentRepository';
import type { PublicationStrategy } from '../../domain/strategies/PublicationStrategy';
import type { AttachmentExternalIdentifier } from '../../domain/value-objects/AttachmentExternalIdentifier';

import { Attachment } from '../../domain/Attachment';
import { AttachmentByteSize } from '../../domain/value-objects/AttachmentByteSize';
import { AttachmentContentType } from '../../domain/value-objects/AttachmentContentType';
import { AttachmentFilename } from '../../domain/value-objects/AttachmentFilename';
import { AttachmentId } from '../../domain/value-objects/AttachmentId';
import { PigeonAttachmentDownloader } from './PigeonAttachmentDownloader';

export class PigeonAttachmentRepository implements AttachmentRepository {
  public constructor(
    private readonly downloader: Pick<
      PigeonAttachmentDownloader,
      'findPrivate' | 'findPublic'
    >,
  ) {}

  public async find(
    externalIdentifier: AttachmentExternalIdentifier,
    publication: PublicationStrategy,
  ): Promise<Attachment> {
    const identifier = externalIdentifier.toString();
    const resource = publication.isEncrypted()
      ? await this.downloader.findPrivate(identifier)
      : await this.downloader.findPublic(identifier);

    return Attachment.restorePublished(
      AttachmentId.fromString(identifier),
      AttachmentFilename.fromString(resource.filename),
      AttachmentContentType.fromString(resource.contentType),
      AttachmentByteSize.fromBytes(resource.size),
      publication,
      externalIdentifier,
    );
  }
}
