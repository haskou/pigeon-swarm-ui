import { SHA256Hash } from '@haskou/value-objects';
import { Buffer } from 'buffer';

import type {
  AttachmentProgress,
  AttachmentUploadOptions,
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

type LegacyPublicFileContent = PublicFileUpload & {
  data: string;
  uploadedAt?: string;
  uploadedByIdentityId?: string;
};

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

  public async getPublicFile(
    cid: string,
    onDownloadProgress?: (percent: number) => void,
  ): Promise<PublicFileContent> {
    if (onDownloadProgress) {
      return await this.fetchPublicFile(cid, onDownloadProgress);
    }

    const cached = this.publicFileCache.get(cid);

    if (cached) return await cached;

    const request = this.fetchPublicFile(cid).catch((caught: unknown) => {
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
    const bytes = await file.arrayBuffer();

    return await this.uploadPublicBytes(
      session,
      bytes,
      file.name || 'upload',
      file.type || 'application/octet-stream',
    );
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

    const request = this.attachmentIsEncrypted(attachment)
      ? this.decryptAttachment(attachment, onProgress)
      : this.downloadPublicAttachment(attachment, onProgress);

    const cachedRequest = request.catch((caught: unknown) => {
      this.attachmentBlobCache.delete(cacheKey);

      throw caught;
    });

    this.attachmentBlobCache.set(cacheKey, cachedRequest);

    return await cachedRequest;
  }

  public async publishMessageAttachments(
    session: Session,
    attachments: File[],
    onProgress?: (progress: AttachmentProgress) => void,
    options: AttachmentUploadOptions = {},
  ): Promise<MessageAttachment[]> {
    if (attachments.length === 0) return [];

    const uploadedAttachments: MessageAttachment[] = [];

    for (const file of attachments) {
      const shouldEncrypt =
        file.size <= ipfsPrivateUploadLimitBytes ||
        options.encryptLargeAttachments === true;

      if (!shouldEncrypt) {
        uploadedAttachments.push(
          await this.uploadPublicChunkedAttachment(session, file, onProgress),
        );

        continue;
      }

      const pending = await this.attachmentCipher.encrypt(file, onProgress);
      const upload = await this.uploadPendingAttachment(
        session,
        pending,
        onProgress,
      );

      uploadedAttachments.push({
        ...pending.metadata,
        cid: upload.cid,
        encrypted: true,
        ...(upload.chunks ? { chunks: upload.chunks } : {}),
        encryptedSize: upload.size,
        ...(upload.type ? { type: upload.type } : {}),
      });
    }

    return uploadedAttachments;
  }

  private async publicFileContent(
    cid: string,
    blob: Blob,
  ): Promise<PublicFileContent> {
    if (blob.type.includes('json')) {
      return this.legacyPublicFileContent(await blob.text());
    }

    return {
      blob,
      cid,
      contentType: blob.type || 'application/octet-stream',
      filename: cid,
      size: blob.size,
    };
  }

  private async fetchPublicFile(
    cid: string,
    onDownloadProgress?: (percent: number) => void,
  ): Promise<PublicFileContent> {
    const blob = await this.http.requestBlob(
      `/ipfs/${encodeURIComponent(cid)}`,
      {
        ...(onDownloadProgress
          ? {
              onDownloadProgress: ({ loadedBytes, totalBytes }) => {
                if (!totalBytes) return;

                onDownloadProgress((loadedBytes * 100) / totalBytes);
              },
            }
          : {}),
      },
    );

    return await this.publicFileContent(cid, blob);
  }

  private legacyPublicFileContent(payload: string): PublicFileContent {
    const content = JSON.parse(payload) as LegacyPublicFileContent;
    const bytes = Uint8Array.from(Buffer.from(content.data, 'base64'));

    return {
      blob: new Blob([bytes], { type: content.contentType }),
      cid: content.cid,
      contentType: content.contentType,
      filename: content.filename,
      size: content.size,
      uploadedAt: content.uploadedAt,
      uploadedByIdentityId: content.uploadedByIdentityId,
    };
  }

  private async decryptAttachment(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    const encryptedBytes = attachment.chunks?.length
      ? await this.downloadAttachmentChunks(attachment, onProgress)
      : await this.downloadPrivateAttachmentBytes(attachment, onProgress);

    return await this.attachmentCipher.decrypt(
      attachment,
      encryptedBytes,
      onProgress,
    );
  }

  private attachmentBlobCacheKey(attachment: MessageAttachment): string {
    return [
      attachment.cid,
      attachment.encrypted === false ? 'public' : 'encrypted',
      attachment.encryptedSize,
      attachment.size,
      attachment.contentType,
      attachment.encryption?.algorithm ?? '',
      attachment.encryption?.key ?? '',
      attachment.encryption?.iv ?? '',
      attachment.encryption?.chunks
        ?.map((chunk) => `${chunk.iv}:${chunk.size}`)
        .join(',') ?? '',
      attachment.chunks
        ?.map(
          (chunk) =>
            `${chunk.index}:${chunk.cid}:${chunk.sha256}:${chunk.size}`,
        )
        .join(',') ?? '',
    ].join('|');
  }

  private attachmentIsEncrypted(attachment: MessageAttachment): boolean {
    return attachment.encrypted !== false && !!attachment.encryption;
  }

  private async downloadPublicAttachment(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    if (!attachment.chunks?.length) {
      const content = await this.getPublicFile(attachment.cid, (percent) =>
        this.reportAttachmentProgress(
          onProgress,
          attachment.filename,
          'download',
          percent,
        ),
      );

      this.reportAttachmentProgress(
        onProgress,
        attachment.filename,
        'download',
        100,
      );

      return content.blob;
    }

    const sortedChunks = [...attachment.chunks].sort(
      (left, right) => left.index - right.index,
    );
    const blobs: Blob[] = [];

    for (let index = 0; index < sortedChunks.length; index += 1) {
      const chunk = sortedChunks[index];
      const content = await this.getPublicFile(chunk.cid, (percent) => {
        const overallPercent =
          ((index + percent / 100) * 100) / sortedChunks.length;

        this.reportAttachmentProgress(
          onProgress,
          attachment.filename,
          'download',
          overallPercent,
        );
      });

      blobs.push(content.blob);
      this.reportAttachmentProgress(
        onProgress,
        attachment.filename,
        'download',
        ((index + 1) * 100) / sortedChunks.length,
      );
    }

    return new Blob(blobs, { type: attachment.contentType });
  }

  private async uploadPublicChunkedAttachment(
    session: Session,
    file: File,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<MessageAttachment> {
    const chunks: NonNullable<MessageAttachment['chunks']> = [];
    const totalChunks = Math.ceil(file.size / ipfsPrivateChunkBytes) || 1;
    const filename = file.name || 'attachment';

    for (let index = 0; index < totalChunks; index += 1) {
      const offset = index * ipfsPrivateChunkBytes;
      const chunk = await file
        .slice(offset, Math.min(offset + ipfsPrivateChunkBytes, file.size))
        .arrayBuffer();
      const upload = await this.uploadPublicBytes(
        session,
        chunk,
        `${filename}.part-${String(index).padStart(4, '0')}`,
      );

      chunks.push({
        cid: upload.cid,
        index,
        sha256: this.sha256Hex(chunk),
        size: upload.size,
      });
      onProgress?.({
        filename,
        percent: Math.min(100, Math.round(((index + 1) * 100) / totalChunks)),
        phase: 'upload',
      });
      await this.yieldToBrowser(ipfsPrivateChunkUploadPauseMs);
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

  private async uploadPublicBytes(
    session: Session,
    bytes: ArrayBuffer,
    filename: string,
    contentType = 'application/octet-stream',
  ): Promise<PublicFileUpload> {
    const path = '/ipfs/public';

    return await this.http.request<PublicFileUpload>(path, {
      body: bytes,
      headers: {
        ...(await this.signer.headers(session, 'POST', path, bytes)),
        'Content-Type': contentType,
        'X-Filename': filename,
      },
      method: 'POST',
    });
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
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<ArrayBuffer> {
    const sortedChunks = [...(attachment.chunks ?? [])].sort(
      (left, right) => left.index - right.index,
    );
    const buffers: ArrayBuffer[] = [];

    for (let index = 0; index < sortedChunks.length; index += 1) {
      const chunk = sortedChunks[index];
      const content = await this.getPrivateFile(chunk.cid);

      buffers.push(
        this.attachmentCipher.bytesToArrayBuffer(
          this.attachmentCipher.base64ToBytes(content.encryptedData),
        ),
      );
      this.reportAttachmentProgress(
        onProgress,
        attachment.filename,
        'download',
        ((index + 1) * 100) / sortedChunks.length,
      );
    }

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

  private async downloadPrivateAttachmentBytes(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<ArrayBuffer> {
    this.reportAttachmentProgress(
      onProgress,
      attachment.filename,
      'download',
      0,
    );
    const content = await this.getPrivateFile(attachment.cid);
    this.reportAttachmentProgress(
      onProgress,
      attachment.filename,
      'download',
      100,
    );

    return this.attachmentCipher.bytesToArrayBuffer(
      this.attachmentCipher.base64ToBytes(content.encryptedData),
    );
  }

  private reportAttachmentProgress(
    onProgress: ((progress: AttachmentProgress) => void) | undefined,
    filename: string,
    phase: AttachmentProgress['phase'],
    percent: number,
  ): void {
    onProgress?.({
      filename,
      percent: Math.max(0, Math.min(100, Math.round(percent))),
      phase,
    });
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
