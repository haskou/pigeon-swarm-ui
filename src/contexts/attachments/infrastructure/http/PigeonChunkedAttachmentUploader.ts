import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { AttachmentProgress } from '../../application/contracts/AttachmentProgress';
import type { MessageAttachment } from '../../application/contracts/MessageAttachment';
import type { PrivateBlobReference } from '../../application/contracts/PrivateBlobReservation';
import type { PendingMessageAttachment } from '../crypto/resources/PendingMessageAttachment';
import type { EncryptedAttachmentUpload } from './EncryptedAttachmentUpload';
import type {
  PrivateBlobReplicator,
  StoredPrivateBlobReplica,
} from './PrivateBlobReplicator';

import { PigeonPublicFilesClient } from './PigeonPublicFilesClient';
import { toPrivateBlobReference } from './privateBlobReference';
import { reportAttachmentUploadProgress } from './reportAttachmentUploadProgress';

const uploadChunkBytes = 8 * 1024 * 1024;
const uploadChunkPauseMs = 35;

function partBounds(
  pending: PendingMessageAttachment,
): { end: number; start: number }[] {
  const chunks = pending.metadata.encryption?.chunks ?? [];
  const size = pending.encryptedBytes.byteLength;
  const lengths =
    chunks.length > 0
      ? chunks.map((chunk) => chunk.size)
      : Array.from({ length: Math.ceil(size / uploadChunkBytes) }, (_, index) =>
          Math.min(uploadChunkBytes, size - index * uploadChunkBytes),
        );
  let start = 0;

  return lengths.map((length) => {
    const bounds = { end: start + length, start };
    start = bounds.end;

    return bounds;
  });
}

export class PigeonChunkedAttachmentUploader {
  public constructor(
    private readonly replicator: Pick<
      PrivateBlobReplicator,
      'abandon' | 'storeParts'
    >,
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
    pending: PendingMessageAttachment,
    onProgress: ((progress: AttachmentProgress) => void) | undefined,
    origins: (string | undefined)[],
  ): Promise<EncryptedAttachmentUpload> {
    const blobs: PrivateBlobReference[] = [];
    const stored: StoredPrivateBlobReplica[][] = [];
    const size = pending.encryptedBytes.byteLength;
    const bounds = partBounds(pending);

    try {
      for (const [index, { end, start }] of bounds.entries()) {
        const [replicas] = await this.replicator.storeParts(
          session,
          1,
          () => pending.encryptedBytes.slice(start, end),
          origins,
        );
        stored.push(replicas);
        blobs.push(toPrivateBlobReference(index, end - start, replicas));
        reportAttachmentUploadProgress(
          onProgress,
          pending.metadata.filename,
          ((index + 1) * 100) / bounds.length,
        );
        await this.yieldToBrowser();
      }
    } catch (error) {
      await this.replicator.abandon(session, stored.flat());
      throw error;
    }

    return { blobs, size, type: 'chunked_file' };
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
