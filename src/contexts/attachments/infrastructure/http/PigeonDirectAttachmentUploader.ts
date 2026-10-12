import type { Session } from '../../../identities/infrastructure/session/Session';
import type { AttachmentProgress } from '../../application/contracts/AttachmentProgress';
import type { MessageAttachment } from '../../application/contracts/MessageAttachment';
import type { PendingMessageAttachment } from '../crypto/resources/PendingMessageAttachment';
import type { EncryptedAttachmentUpload } from './EncryptedAttachmentUpload';
import type { PrivateBlobReplicator } from './PrivateBlobReplicator';

import { PigeonPublicFilesClient } from './PigeonPublicFilesClient';
import { toPrivateBlobReference } from './privateBlobReference';
import { reportAttachmentUploadProgress } from './reportAttachmentUploadProgress';

export class PigeonDirectAttachmentUploader {
  public constructor(
    private readonly replicator: Pick<PrivateBlobReplicator, 'storeParts'>,
    private readonly publicFiles: Pick<PigeonPublicFilesClient, 'upload'>,
  ) {}

  public async uploadEncrypted(
    session: Session,
    pending: PendingMessageAttachment,
    onProgress: ((progress: AttachmentProgress) => void) | undefined,
    origins: (string | undefined)[],
  ): Promise<EncryptedAttachmentUpload> {
    const size = pending.encryptedBytes.byteLength;

    reportAttachmentUploadProgress(onProgress, pending.metadata.filename, 0);
    const [replicas] = await this.replicator.storeParts(
      session,
      1,
      () => pending.encryptedBytes,
      origins,
    );
    reportAttachmentUploadProgress(onProgress, pending.metadata.filename, 100);

    return {
      blobs: [toPrivateBlobReference(0, size, replicas)],
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
