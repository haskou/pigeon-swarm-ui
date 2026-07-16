import type {
  AttachmentProgress,
  MessageAttachment,
  PrivateFileContent,
  PublicFileContent,
} from '../../../../shared/domain/pigeonResources.types';

import { AttachmentBinaryCodec } from '../crypto/AttachmentBinaryCodec';
import { AttachmentCipher } from '../crypto/AttachmentCipher';
import { attachmentBlobCacheKey } from './attachmentBlobCacheKey';
import { PigeonFileRequestCache } from './PigeonFileRequestCache';
import { PigeonPrivateFilesClient } from './PigeonPrivateFilesClient';
import { PigeonPublicFilesClient } from './PigeonPublicFilesClient';

export class PigeonAttachmentDownloader {
  private readonly attachmentCache = new PigeonFileRequestCache<Blob>();

  private readonly privateFileCache =
    new PigeonFileRequestCache<PrivateFileContent>();

  private readonly publicFileCache =
    new PigeonFileRequestCache<PublicFileContent>();

  public constructor(
    private readonly privateFiles: PigeonPrivateFilesClient,
    private readonly publicFiles: PigeonPublicFilesClient,
    private readonly cipher: AttachmentCipher,
    private readonly codec: AttachmentBinaryCodec,
  ) {}

  private async downloadEncrypted(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    const encryptedBytes = attachment.chunks?.length
      ? await this.downloadEncryptedChunks(attachment, onProgress)
      : await this.downloadPrivateBytes(attachment, onProgress);

    return await this.cipher.decrypt(attachment, encryptedBytes, onProgress);
  }

  private async downloadEncryptedChunks(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<ArrayBuffer> {
    const chunks = [...(attachment.chunks ?? [])].sort(
      (left, right) => left.index - right.index,
    );
    const buffers: ArrayBuffer[] = [];

    for (let index = 0; index < chunks.length; index += 1) {
      const content = await this.findPrivate(chunks[index].cid);

      buffers.push(this.codec.base64ToArrayBuffer(content.encryptedData));
      this.reportProgress(
        onProgress,
        attachment.filename,
        ((index + 1) * 100) / chunks.length,
      );
    }

    return this.codec.concatArrayBuffers(buffers);
  }

  private async downloadPrivateBytes(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<ArrayBuffer> {
    this.reportProgress(onProgress, attachment.filename, 0);
    const content = await this.findPrivate(attachment.cid);
    this.reportProgress(onProgress, attachment.filename, 100);

    return this.codec.base64ToArrayBuffer(content.encryptedData);
  }

  private async downloadPublic(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    if (!attachment.chunks?.length) {
      const content = await this.findPublic(attachment.cid, (percent) =>
        this.reportProgress(onProgress, attachment.filename, percent),
      );

      this.reportProgress(onProgress, attachment.filename, 100);

      return content.blob;
    }

    const chunks = [...attachment.chunks].sort(
      (left, right) => left.index - right.index,
    );
    const blobs: Blob[] = [];

    for (let index = 0; index < chunks.length; index += 1) {
      const content = await this.findPublic(chunks[index].cid, (percent) =>
        this.reportProgress(
          onProgress,
          attachment.filename,
          ((index + percent / 100) * 100) / chunks.length,
        ),
      );

      blobs.push(content.blob);
      this.reportProgress(
        onProgress,
        attachment.filename,
        ((index + 1) * 100) / chunks.length,
      );
    }

    return new Blob(blobs, { type: attachment.contentType });
  }

  private isEncrypted(attachment: MessageAttachment): boolean {
    return attachment.encrypted !== false && !!attachment.encryption;
  }

  private reportProgress(
    reporter: ((progress: AttachmentProgress) => void) | undefined,
    filename: string,
    percent: number,
  ): void {
    reporter?.({
      filename,
      percent: Math.max(0, Math.min(100, Math.round(percent))),
      phase: 'download',
    });
  }

  public async download(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    return await this.attachmentCache.getOrCreate(
      attachmentBlobCacheKey(attachment),
      () =>
        this.isEncrypted(attachment)
          ? this.downloadEncrypted(attachment, onProgress)
          : this.downloadPublic(attachment, onProgress),
    );
  }

  public async findPrivate(cid: string): Promise<PrivateFileContent> {
    return await this.privateFileCache.getOrCreate(cid, () =>
      this.privateFiles.fetch(cid),
    );
  }

  public async findPublic(
    cid: string,
    onProgress?: (percent: number) => void,
  ): Promise<PublicFileContent> {
    if (onProgress) return await this.publicFiles.fetch(cid, onProgress);

    return await this.publicFileCache.getOrCreate(cid, () =>
      this.publicFiles.fetch(cid),
    );
  }
}
