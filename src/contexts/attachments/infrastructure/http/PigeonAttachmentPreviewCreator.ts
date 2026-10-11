import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { MessageAttachment } from '../../application/contracts/MessageAttachment';

import { AttachmentCipher } from '../crypto/AttachmentCipher';
import { MessageAttachmentThumbnailPreparer } from '../media/MessageAttachmentThumbnailPreparer';
import { PigeonAttachmentBlobUploader } from './PigeonAttachmentBlobUploader';

export class PigeonAttachmentPreviewCreator {
  public constructor(
    private readonly cipher: Pick<AttachmentCipher, 'encrypt'>,
    private readonly blobs: Pick<
      PigeonAttachmentBlobUploader,
      'uploadEncrypted' | 'uploadPublic'
    >,
    private readonly thumbnails: Pick<
      MessageAttachmentThumbnailPreparer,
      'prepare'
    >,
  ) {}

  private async prepareThumbnail(file: File): Promise<File | null> {
    return await this.thumbnails.prepare(file).catch(() => null);
  }

  public async createEncrypted(
    session: Session,
    file: File,
  ): Promise<MessageAttachment | undefined> {
    return await (async () => {
      const thumbnail = await this.prepareThumbnail(file);

      if (!thumbnail) return undefined;

      const pending = await this.cipher.encrypt(thumbnail);
      const upload = await this.blobs.uploadEncrypted(session, pending);

      return {
        ...pending.metadata,
        blobs: upload.blobs,
        encrypted: true,
        encryptedSize: upload.size,
        ...(upload.type ? { type: upload.type } : {}),
      };
    })().catch(() => undefined);
  }

  public async createPublic(
    session: Session,
    file: File,
  ): Promise<MessageAttachment | undefined> {
    const thumbnail = await this.prepareThumbnail(file);

    if (!thumbnail) return undefined;

    return await this.blobs
      .uploadPublic(session, thumbnail)
      .catch(() => undefined);
  }
}
