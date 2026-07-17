import type { AttachmentRepository } from '../../domain/repositories/AttachmentRepository';
import type { PublicationStrategy } from '../../domain/strategies/PublicationStrategy';
import type { AttachmentPublisherExternalIdentifier } from '../../domain/value-objects/AttachmentPublisherExternalIdentifier';
import type { AttachmentSourceExternalIdentifier } from '../../domain/value-objects/AttachmentSourceExternalIdentifier';

import { Attachment } from '../../domain/Attachment';
import { AttachmentExternalIdentifier } from '../../domain/value-objects/AttachmentExternalIdentifier';
import { AttachmentPublicationContexts } from './AttachmentPublicationContexts';
import { PigeonAttachmentDownloader } from './PigeonAttachmentDownloader';
import { PigeonMessageAttachmentUploader } from './PigeonMessageAttachmentUploader';

export class PigeonAttachmentRepository implements AttachmentRepository {
  public constructor(
    private readonly downloader: Pick<
      PigeonAttachmentDownloader,
      'findPrivate' | 'findPublic'
    >,
    private readonly uploader: Pick<
      PigeonMessageAttachmentUploader,
      'publishEncrypted' | 'publishPublic'
    >,
    private readonly contexts: AttachmentPublicationContexts,
  ) {}

  public async create(
    attachment: Attachment,
    sourceExternalIdentifier: AttachmentSourceExternalIdentifier,
    publisherExternalIdentifier: AttachmentPublisherExternalIdentifier,
  ): Promise<AttachmentExternalIdentifier> {
    const { file, onProgress, session } = this.contexts.take(
      sourceExternalIdentifier,
      publisherExternalIdentifier,
    );
    const resource = attachment.isEncrypted()
      ? await this.uploader.publishEncrypted(
          session,
          file,
          attachment.getEncryptionNetworkId(),
          onProgress,
        )
      : await this.uploader.publishPublic(session, file, onProgress);

    this.contexts.complete(sourceExternalIdentifier, resource);

    return AttachmentExternalIdentifier.fromString(resource.cid);
  }

  public async find(
    externalIdentifier: AttachmentExternalIdentifier,
    publication: PublicationStrategy,
  ): Promise<Attachment> {
    const identifier = externalIdentifier.toString();
    const resource = publication.isEncrypted()
      ? await this.downloader.findPrivate(identifier)
      : await this.downloader.findPublic(identifier);

    return Attachment.fromPrimitives({
      contentType: resource.contentType,
      externalIdentifier: identifier,
      filename: resource.filename,
      id: identifier,
      publication: publication.isEncrypted()
        ? {
            encrypted: true,
            ...(publication.hasEncryptionNetwork()
              ? {
                  networkId: publication.getEncryptionNetworkId().toString(),
                }
              : {}),
          }
        : { encrypted: false },
      size: resource.size,
      status: 'published',
    });
  }
}
