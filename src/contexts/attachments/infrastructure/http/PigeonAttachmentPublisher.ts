import type { AttachmentPublisher } from '../../application/publish-message-attachment/AttachmentPublisher';
import type { Attachment } from '../../domain/Attachment';
import type { AttachmentPublisherExternalIdentifier } from '../../domain/value-objects/AttachmentPublisherExternalIdentifier';
import type { AttachmentSourceExternalIdentifier } from '../../domain/value-objects/AttachmentSourceExternalIdentifier';

import { AttachmentExternalIdentifier } from '../../domain/value-objects/AttachmentExternalIdentifier';
import { AttachmentPublicationContexts } from './AttachmentPublicationContexts';
import { PigeonMessageAttachmentUploader } from './PigeonMessageAttachmentUploader';

export class PigeonAttachmentPublisher implements AttachmentPublisher {
  public constructor(
    private readonly uploader: Pick<
      PigeonMessageAttachmentUploader,
      'publishEncrypted' | 'publishPublic'
    >,
    private readonly contexts: AttachmentPublicationContexts,
  ) {}

  public async publish(
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
          attachment.getNetworkId(),
          onProgress,
        )
      : await this.uploader.publishPublic(session, file, onProgress);

    this.contexts.complete(sourceExternalIdentifier, resource);

    return AttachmentExternalIdentifier.fromString(resource.cid);
  }
}
