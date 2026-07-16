import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { PendingMessageAttachment } from '../crypto/resources/PendingMessageAttachment';
import type { AttachmentProgress } from '../resources/AttachmentProgress';
import type { MessageAttachment } from '../resources/MessageAttachment';
import type { EncryptedAttachmentUpload } from './EncryptedAttachmentUpload';

import { PigeonPrivateFilesClient } from './PigeonPrivateFilesClient';
import { PigeonPublicFilesClient } from './PigeonPublicFilesClient';
import { reportAttachmentUploadProgress } from './reportAttachmentUploadProgress';

export class PigeonDirectAttachmentUploader {
  public constructor(
    private readonly privateFiles: Pick<PigeonPrivateFilesClient, 'upload'>,
    private readonly publicFiles: Pick<PigeonPublicFilesClient, 'upload'>,
  ) {}

  public async uploadEncrypted(
    session: Session,
    networkId: string,
    pending: PendingMessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<EncryptedAttachmentUpload> {
    reportAttachmentUploadProgress(onProgress, pending.metadata.filename, 0);
    const upload = await this.privateFiles.upload(
      session,
      networkId,
      pending.encryptedBytes,
      pending.uploadFilename,
    );
    reportAttachmentUploadProgress(onProgress, pending.metadata.filename, 100);

    return { cid: upload.cid, size: upload.size };
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
