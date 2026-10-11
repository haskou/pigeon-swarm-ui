import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { AttachmentProgress } from '../../application/contracts/AttachmentProgress';
import type { MessageAttachment } from '../../application/contracts/MessageAttachment';
import type { PendingMessageAttachment } from '../crypto/resources/PendingMessageAttachment';
import type { EncryptedAttachmentUpload } from './EncryptedAttachmentUpload';

import { PigeonPrivateBlobClient } from './PigeonPrivateBlobClient';
import { PigeonPublicFilesClient } from './PigeonPublicFilesClient';
import { reportAttachmentUploadProgress } from './reportAttachmentUploadProgress';

export class PigeonDirectAttachmentUploader {
  public constructor(
    private readonly privateBlobs: Pick<
      PigeonPrivateBlobClient,
      'reserve' | 'upload'
    >,
    private readonly publicFiles: Pick<PigeonPublicFilesClient, 'upload'>,
  ) {}

  public async uploadEncrypted(
    session: Session,
    pending: PendingMessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<EncryptedAttachmentUpload> {
    const size = pending.encryptedBytes.byteLength;

    reportAttachmentUploadProgress(onProgress, pending.metadata.filename, 0);
    const reservation = await this.privateBlobs.reserve(session, size);
    await this.privateBlobs.upload(reservation, pending.encryptedBytes);
    reportAttachmentUploadProgress(onProgress, pending.metadata.filename, 100);

    return {
      blobs: [
        {
          blobId: reservation.blobId,
          downloadToken: reservation.downloadToken,
          expiresAt: reservation.expiresAt,
          index: 0,
          size,
        },
      ],
      size,
    };
  }

  public async uploadPublic(
    session: Session,
    file: File,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<MessageAttachment> {
    const filename = file.name || 'attachment';

    reportAttachmentUploadProgress(onProgress, filename, 0);
    const upload = await this.publicFiles.upload(
      session,
      await file.arrayBuffer(),
      filename,
      file.type || 'application/octet-stream',
    );
    reportAttachmentUploadProgress(onProgress, filename, 100);

    return {
      cid: upload.cid,
      contentType: upload.contentType,
      encrypted: false,
      filename: upload.filename,
      size: upload.size,
      storage: 'public',
    };
  }
}
