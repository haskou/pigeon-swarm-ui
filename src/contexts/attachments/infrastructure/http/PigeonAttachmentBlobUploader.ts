import { SHA256Hash } from '@haskou/value-objects';
import { Buffer } from 'buffer';

import type {
  AttachmentProgress,
  MessageAttachment,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { PendingMessageAttachment } from '../crypto/resources/PendingMessageAttachment';
import type { EncryptedAttachmentUpload } from './EncryptedAttachmentUpload';

import { PigeonPrivateFilesClient } from './PigeonPrivateFilesClient';
import { PigeonPublicFilesClient } from './PigeonPublicFilesClient';

const directUploadLimitBytes = 50 * 1024 * 1024;
const uploadChunkBytes = 8 * 1024 * 1024;
const uploadChunkPauseMs = 35;

export class PigeonAttachmentBlobUploader {
  public constructor(
    private readonly privateFiles: PigeonPrivateFilesClient,
    private readonly publicFiles: PigeonPublicFilesClient,
  ) {}

  private async uploadPublicChunks(
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
      this.reportProgress(
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

  private async uploadPublicFile(
    session: Session,
    file: File,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<MessageAttachment> {
    const filename = file.name || 'attachment';

    this.reportProgress(onProgress, filename, 0);
    const upload = await this.publicFiles.upload(
      session,
      await file.arrayBuffer(),
      filename,
      file.type || 'application/octet-stream',
    );
    this.reportProgress(onProgress, filename, 100);

    return {
      cid: upload.cid,
      contentType: upload.contentType,
      encrypted: false,
      filename: upload.filename,
      size: upload.size,
      storage: 'public',
    };
  }

  private reportProgress(
    reporter: ((progress: AttachmentProgress) => void) | undefined,
    filename: string,
    percent: number,
  ): void {
    reporter?.({
      filename,
      percent: Math.max(0, Math.min(100, Math.round(percent))),
      phase: 'upload',
    });
  }

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
    if (pending.encryptedBytes.byteLength <= directUploadLimitBytes) {
      this.reportProgress(onProgress, pending.metadata.filename, 0);
      const upload = await this.privateFiles.upload(
        session,
        networkId,
        pending.encryptedBytes,
        pending.uploadFilename,
      );
      this.reportProgress(onProgress, pending.metadata.filename, 100);

      return { cid: upload.cid, size: upload.size };
    }

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
      this.reportProgress(
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
    return file.size > directUploadLimitBytes
      ? await this.uploadPublicChunks(session, file, onProgress)
      : await this.uploadPublicFile(session, file, onProgress);
  }
}
