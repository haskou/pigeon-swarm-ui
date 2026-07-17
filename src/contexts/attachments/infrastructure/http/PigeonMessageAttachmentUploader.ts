import type {
  AttachmentProgress,
  MessageAttachment,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { AttachmentNetworkId } from '../../domain/value-objects/AttachmentNetworkId';

import { AttachmentCipher } from '../crypto/AttachmentCipher';
import { PublicImageUploadPreparer } from '../media/PublicImageUploadPreparer';
import { PigeonAttachmentBlobUploader } from './PigeonAttachmentBlobUploader';
import { PigeonAttachmentPreviewCreator } from './PigeonAttachmentPreviewCreator';

export class PigeonMessageAttachmentUploader {
  public constructor(
    private readonly cipher: AttachmentCipher,
    private readonly blobs: PigeonAttachmentBlobUploader,
    private readonly publicImages: Pick<PublicImageUploadPreparer, 'prepare'>,
    private readonly previews: Pick<
      PigeonAttachmentPreviewCreator,
      'createEncrypted' | 'createPublic'
    >,
  ) {}

  private withPreview(
    attachment: MessageAttachment,
    preview?: MessageAttachment,
  ): MessageAttachment {
    return preview ? { ...attachment, preview } : attachment;
  }

  public async publishEncrypted(
    session: Session,
    file: File,
    networkId: AttachmentNetworkId,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<MessageAttachment> {
    const preview = await this.previews.createEncrypted(
      session,
      networkId,
      file,
    );
    const pending = await this.cipher.encrypt(file, onProgress);
    const upload = await this.blobs.uploadEncrypted(
      session,
      networkId.toString(),
      pending,
      onProgress,
    );

    return this.withPreview(
      {
        ...pending.metadata,
        cid: upload.cid,
        encrypted: true,
        ...(upload.chunks ? { chunks: upload.chunks } : {}),
        encryptedSize: upload.size,
        ...(upload.type ? { type: upload.type } : {}),
      },
      preview,
    );
  }

  public async publishPublic(
    session: Session,
    file: File,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<MessageAttachment> {
    const prepared = await this.publicImages.prepare(file);
    const preview = await this.previews.createPublic(session, file);

    return this.withPreview(
      await this.blobs.uploadPublic(session, prepared, onProgress),
      preview,
    );
  }
}
