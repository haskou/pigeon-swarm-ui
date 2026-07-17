import { SHA256Hash } from '@haskou/value-objects';
import { Buffer } from 'buffer';

import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { AttachmentProgress } from '../../application/contracts/AttachmentProgress';
import type { MessageAttachment } from '../../application/contracts/MessageAttachment';
import type { PendingMessageAttachment } from '../crypto/resources/PendingMessageAttachment';
import type { EncryptedAttachmentUpload } from './EncryptedAttachmentUpload';

import { PigeonPrivateFilesClient } from './PigeonPrivateFilesClient';
import { PigeonPublicFilesClient } from './PigeonPublicFilesClient';
import { reportAttachmentUploadProgress } from './reportAttachmentUploadProgress';

const uploadChunkBytes = 8 * 1024 * 1024;
const uploadChunkPauseMs = 35;

export class PigeonChunkedAttachmentUploader {
  public constructor(
    private readonly privateFiles: Pick<PigeonPrivateFilesClient, 'upload'>,
    private readonly publicFiles: Pick<PigeonPublicFilesClient, 'upload'>,
  ) {}

  private sha256(bytes: ArrayBuffer): string {
    return SHA256Hash.from(Buffer.from(bytes)).toString();
  }

  private async yieldToBrowser(): Promise<void> {
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, uploadChunkPauseMs);
    });
  }

  public async uploadEncrypted(
    session: Session,
    networkId: string,
    pending: PendingMessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<EncryptedAttachmentUpload> {
    const chunks: NonNullable<MessageAttachment['chunks']> = [];
    const totalChunks = Math.ceil(
      pending.encryptedBytes.byteLength / uploadChunkBytes,
    );

    for (let index = 0; index < totalChunks; index += 1) {
      const offset = index * uploadChunkBytes;
      const chunk = pending.encryptedBytes.slice(
        offset,
        Math.min(offset + uploadChunkBytes, pending.encryptedBytes.byteLength),
      );
      const upload = await this.privateFiles.upload(
        session,
        networkId,
        chunk,
        `${pending.uploadFilename}.part-${String(index).padStart(4, '0')}`,
      );

      chunks.push({
        cid: upload.cid,
        index,
        sha256: this.sha256(chunk),
        size: upload.size,
      });
      reportAttachmentUploadProgress(
        onProgress,
        pending.metadata.filename,
        ((index + 1) * 100) / totalChunks,
      );
      await this.yieldToBrowser();
    }

    return {
      chunks,
      cid: chunks[0]?.cid ?? '',
      size: pending.encryptedBytes.byteLength,
      type: 'chunked_file',
    };
  }

  public async uploadPublic(
    session: Session,
    file: File,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<MessageAttachment> {
    const chunks: NonNullable<MessageAttachment['chunks']> = [];
    const totalChunks = Math.ceil(file.size / uploadChunkBytes) || 1;
    const filename = file.name || 'attachment';

    for (let index = 0; index < totalChunks; index += 1) {
      const offset = index * uploadChunkBytes;
      const chunk = await file
        .slice(offset, Math.min(offset + uploadChunkBytes, file.size))
        .arrayBuffer();
      const upload = await this.publicFiles.upload(
        session,
        chunk,
        `${filename}.part-${String(index).padStart(4, '0')}`,
      );

      chunks.push({
        cid: upload.cid,
        index,
        sha256: this.sha256(chunk),
        size: upload.size,
      });
      reportAttachmentUploadProgress(
        onProgress,
        filename,
        ((index + 1) * 100) / totalChunks,
      );
      await this.yieldToBrowser();
    }

    return {
      chunks,
      cid: chunks[0]?.cid ?? '',
      contentType: file.type || 'application/octet-stream',
      encrypted: false,
      filename,
      size: file.size,
      storage: 'public',
      type: 'chunked_file',
    };
  }
}
