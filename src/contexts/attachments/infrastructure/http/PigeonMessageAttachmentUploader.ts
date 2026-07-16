import type {
  AttachmentProgress,
  MessageAttachment,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { AttachmentNetworkId } from '../../domain/value-objects/AttachmentNetworkId';

import { AttachmentCipher } from '../crypto/AttachmentCipher';
import { MessageAttachmentThumbnailPreparer } from '../media/MessageAttachmentThumbnailPreparer';
import { PublicImageUploadPreparer } from '../media/PublicImageUploadPreparer';
import { PigeonAttachmentBlobUploader } from './PigeonAttachmentBlobUploader';

export class PigeonMessageAttachmentUploader {
  public constructor(
    private readonly cipher: AttachmentCipher,
    private readonly blobs: PigeonAttachmentBlobUploader,
    private readonly publicImages: Pick<PublicImageUploadPreparer, 'prepare'>,
    private readonly thumbnails: Pick<
      MessageAttachmentThumbnailPreparer,
      'prepare'
    >,
  ) {}

  private async privatePreview(
    session: Session,
    networkId: string,
    file: File,
  ): Promise<MessageAttachment | undefined> {
    return await (async () => {
      const thumbnail = await this.prepareThumbnail(file);

      if (!thumbnail) return undefined;

      const pending = await this.cipher.encrypt(thumbnail);
      const upload = await this.blobs.uploadEncrypted(
        session,
        networkId,
        pending,
      );

      return {
        ...pending.metadata,
        cid: upload.cid,
        encrypted: true,
        encryptedSize: upload.size,
        ...(upload.chunks ? { chunks: upload.chunks } : {}),
        ...(upload.type ? { type: upload.type } : {}),
      };
    })().catch(() => undefined);
  }

  private async publicPreview(
    session: Session,
    file: File,
  ): Promise<MessageAttachment | undefined> {
    const thumbnail = await this.prepareThumbnail(file);

    if (!thumbnail) return undefined;

    return await this.blobs
      .uploadPublic(session, thumbnail)
      .catch(() => undefined);
  }

  private async prepareThumbnail(file: File): Promise<File | null> {
    return await this.thumbnails.prepare(file).catch(() => null);
  }

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
    const network = networkId.toString();
    const preview = await this.privatePreview(session, network, file);
    const pending = await this.cipher.encrypt(file, onProgress);
    const upload = await this.blobs.uploadEncrypted(
      session,
      network,
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
    const preview = await this.publicPreview(session, file);

    return this.withPreview(
      await this.blobs.uploadPublic(session, prepared, onProgress),
      preview,
    );
  }
}
