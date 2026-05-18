import { SHA256Hash } from '@haskou/value-objects';
import { Buffer } from 'buffer';

import type {
  AttachmentProgress,
  MessageAttachment,
  PendingMessageAttachment,
  PrivateFileContent,
  PrivateFileUpload,
  PublicFileContent,
  PublicFileUpload,
  Session,
} from '../../domain/types';
import type { HttpJsonClient } from '../http/HttpJsonClient';
import type { RequestSigner } from './RequestSigner';

import { AttachmentCipher } from '../../domain/attachments/AttachmentCipher';

const ipfsPrivateUploadLimitBytes = 50 * 1024 * 1024;
const ipfsPrivateChunkBytes = 8 * 1024 * 1024;
const ipfsPrivateChunkUploadPauseMs = 35;

export class PigeonFilesApi {
  private readonly attachmentCipher: AttachmentCipher;

  private readonly privateFileCache = new Map<
    string,
    Promise<PrivateFileContent>
  >();

  private readonly publicFileCache = new Map<
    string,
    Promise<PublicFileContent>
  >();

  private readonly attachmentBlobCache = new Map<string, Promise<Blob>>();

  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    attachmentCipher: AttachmentCipher = new AttachmentCipher(),
  ) {
    this.attachmentCipher = attachmentCipher;
  }

  public async getPublicFile(cid: string): Promise<PublicFileContent> {
    const cached = this.publicFileCache.get(cid);

    if (cached) return await cached;

    const request = this.http
      .request<PublicFileContent>(`/ipfs/${encodeURIComponent(cid)}`)
      .catch((caught: unknown) => {
        this.publicFileCache.delete(cid);

        throw caught;
      });

    this.publicFileCache.set(cid, request);

    return await request;
  }

  public async getPrivateFile(cid: string): Promise<PrivateFileContent> {
    const cached = this.privateFileCache.get(cid);

    if (cached) return await cached;

    const request = this.http
      .request<PrivateFileContent>(`/ipfs/${encodeURIComponent(cid)}`)
      .catch((caught: unknown) => {
        this.privateFileCache.delete(cid);

        throw caught;
      });

    this.privateFileCache.set(cid, request);

    return await request;
  }

  public async uploadPublicFile(
    session: Session,
    file: File,
  ): Promise<PublicFileUpload> {
    const path = '/ipfs/public';
    const bytes = await file.arrayBuffer();

    return await this.http.request<PublicFileUpload>(path, {
      body: bytes,
      headers: {
        ...(await this.signer.headers(session, 'POST', path, bytes)),
        'Content-Type': file.type || 'application/octet-stream',
        'X-Filename': file.name || 'upload',
      },
      method: 'POST',
    });
  }

  public async uploadPrivateFile(
    session: Session,
    attachment: PendingMessageAttachment,
  ): Promise<PrivateFileUpload> {
    return await this.uploadPrivateBytes(
      session,
      attachment.encryptedBytes,
      attachment.uploadFilename,
    );
  }

  public async downloadAttachment(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    const cacheKey = this.attachmentBlobCacheKey(attachment);
    const cached = this.attachmentBlobCache.get(cacheKey);

    if (cached) return await cached;

    const request = this.decryptAttachment(attachment, onProgress).catch(
      (caught: unknown) => {
        this.attachmentBlobCache.delete(cacheKey);

        throw caught;
      },
    );

    this.attachmentBlobCache.set(cacheKey, request);

    return await request;
  }

  public async publishMessageAttachments(
    session: Session,
    attachments: File[],
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<MessageAttachment[]> {
    if (attachments.length === 0) return [];

    const uploadedAttachments: MessageAttachment[] = [];

    for (const file of attachments) {
      const pending = await this.attachmentCipher.encrypt(file, onProgress);
      const upload = await this.uploadPendingAttachment(
        session,
        pending,
        onProgress,
      );

      uploadedAttachments.push({
        ...pending.metadata,
        cid: upload.cid,
        ...(upload.chunks ? { chunks: upload.chunks } : {}),
        encryptedSize: upload.size,
        ...(upload.type ? { type: upload.type } : {}),
      });
    }

    return uploadedAttachments;
  }

  private async decryptAttachment(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    const encryptedBytes = attachment.chunks?.length
      ? await this.downloadAttachmentChunks(attachment)
      : this.attachmentCipher.bytesToArrayBuffer(
          this.attachmentCipher.base64ToBytes(
            (await this.getPrivateFile(attachment.cid)).encryptedData,
          ),
        );

    return await this.attachmentCipher.decrypt(
      attachment,
      encryptedBytes,
      onProgress,
    );
  }

  private attachmentBlobCacheKey(attachment: MessageAttachment): string {
    return [
      attachment.cid,
      attachment.encryptedSize,
      attachment.size,
      attachment.contentType,
      attachment.encryption.algorithm,
      attachment.encryption.key,
      attachment.encryption.iv,
      attachment.encryption.chunks
        ?.map((chunk) => `${chunk.iv}:${chunk.size}`)
        .join(',') ?? '',
    ].join('|');
  }

  private async uploadPendingAttachment(
    session: Session,
    pending: PendingMessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<{
    chunks?: MessageAttachment['chunks'];
    cid: string;
    size: number;
    type?: MessageAttachment['type'];
  }> {
    if (pending.encryptedBytes.byteLength <= ipfsPrivateUploadLimitBytes) {
      onProgress?.({
        filename: pending.metadata.filename,
        percent: 0,
        phase: 'upload',
      });
      const upload = await this.uploadPrivateFile(session, pending);

      onProgress?.({
        filename: pending.metadata.filename,
        percent: 100,
        phase: 'upload',
      });

      return { cid: upload.cid, size: upload.size };
    }

    const chunks: NonNullable<MessageAttachment['chunks']> = [];
    const totalChunks = Math.ceil(
      pending.encryptedBytes.byteLength / ipfsPrivateChunkBytes,
    );

    for (let index = 0; index < totalChunks; index += 1) {
      const offset = index * ipfsPrivateChunkBytes;
      const chunk = pending.encryptedBytes.slice(
        offset,
        Math.min(
          offset + ipfsPrivateChunkBytes,
          pending.encryptedBytes.byteLength,
        ),
      );
      const upload = await this.uploadPrivateBytes(
        session,
        chunk,
        `${pending.uploadFilename}.part-${String(index).padStart(4, '0')}`,
      );

      chunks.push({
        cid: upload.cid,
        index,
        sha256: this.sha256Hex(chunk),
        size: upload.size,
      });
      onProgress?.({
        filename: pending.metadata.filename,
        percent: Math.min(100, Math.round(((index + 1) * 100) / totalChunks)),
        phase: 'upload',
      });
      await this.yieldToBrowser(ipfsPrivateChunkUploadPauseMs);
    }

    return {
      chunks,
      cid: chunks[0]?.cid ?? '',
      size: pending.encryptedBytes.byteLength,
      type: 'chunked_file',
    };
  }

  private async uploadPrivateBytes(
    session: Session,
    bytes: ArrayBuffer,
    filename: string,
  ): Promise<PrivateFileUpload> {
    const path = '/ipfs/private';

    return await this.http.request<PrivateFileUpload>(path, {
      body: bytes,
      headers: {
        ...(await this.signer.headers(session, 'POST', path, bytes)),
        'Content-Type': 'application/octet-stream',
        'X-Filename': filename,
      },
      method: 'POST',
    });
  }

  private async downloadAttachmentChunks(
    attachment: MessageAttachment,
  ): Promise<ArrayBuffer> {
    const buffers = await Promise.all(
      [...(attachment.chunks ?? [])]
        .sort((left, right) => left.index - right.index)
        .map(async (chunk) =>
          this.attachmentCipher.bytesToArrayBuffer(
            this.attachmentCipher.base64ToBytes(
              (await this.getPrivateFile(chunk.cid)).encryptedData,
            ),
          ),
        ),
    );
    const totalSize = buffers.reduce(
      (total, buffer) => total + buffer.byteLength,
      0,
    );
    const output = new Uint8Array(totalSize);
    let offset = 0;

    buffers.forEach((buffer) => {
      output.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    });

    return output.buffer;
  }

  private sha256Hex(bytes: ArrayBuffer): string {
    return SHA256Hash.from(Buffer.from(bytes)).toString();
  }

  private async yieldToBrowser(delayMs = 0): Promise<void> {
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, delayMs);
    });
  }
}
