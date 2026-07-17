import type {
  AttachmentProgress,
  MessageAttachment,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { PendingMessageAttachment } from '../crypto/resources/PendingMessageAttachment';
import type { EncryptedAttachmentUpload } from './EncryptedAttachmentUpload';

import { PigeonChunkedAttachmentUploader } from './PigeonChunkedAttachmentUploader';
import { PigeonDirectAttachmentUploader } from './PigeonDirectAttachmentUploader';

const directUploadLimitBytes = 50 * 1024 * 1024;

export class PigeonAttachmentBlobUploader {
  public constructor(
    private readonly direct: Pick<
      PigeonDirectAttachmentUploader,
      'uploadEncrypted' | 'uploadPublic'
    >,
    private readonly chunked: Pick<
      PigeonChunkedAttachmentUploader,
      'uploadEncrypted' | 'uploadPublic'
    >,
  ) {}

  public async uploadEncrypted(
    session: Session,
    networkId: string,
    pending: PendingMessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<EncryptedAttachmentUpload> {
    return pending.encryptedBytes.byteLength <= directUploadLimitBytes
      ? await this.direct.uploadEncrypted(
          session,
          networkId,
          pending,
          onProgress,
        )
      : await this.chunked.uploadEncrypted(
          session,
          networkId,
          pending,
          onProgress,
        );
  }

  public async uploadPublic(
    session: Session,
    file: File,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<MessageAttachment> {
    return file.size <= directUploadLimitBytes
      ? await this.direct.uploadPublic(session, file, onProgress)
      : await this.chunked.uploadPublic(session, file, onProgress);
  }
}
