import type { AttachmentProgress } from '../../application/contracts/AttachmentProgress';
import type { MessageAttachment } from '../../application/contracts/MessageAttachment';
import type { PrivateBlobReference } from '../../application/contracts/PrivateBlobReservation';
import type { PublicFileContent } from '../../application/contracts/PublicFileContent';

import { MailboxHomeBase } from '../../../../shared/infrastructure/client/MailboxHomeBase';
import { AttachmentBinaryCodec } from '../crypto/AttachmentBinaryCodec';
import { AttachmentCipher } from '../crypto/AttachmentCipher';
import { attachmentBlobCacheKey } from './attachmentBlobCacheKey';
import { PigeonFileRequestCache } from './PigeonFileRequestCache';
import { PigeonPrivateBlobClient } from './PigeonPrivateBlobClient';
import { PigeonPublicFilesClient } from './PigeonPublicFilesClient';
import { PrivateBlobUnavailableError } from './PrivateBlobUnavailableError';

type PrivateBlobCandidate = Pick<
  PrivateBlobReference,
  'blobId' | 'downloadToken' | 'origin' | 'size'
>;

type PrivateBlobPart = {
  bytes: ArrayBuffer;
  candidates: PrivateBlobCandidate[];
  served: number;
};

export class PigeonAttachmentDownloader {
  private readonly attachmentCache = new PigeonFileRequestCache<Blob>();

  private readonly publicFileCache =
    new PigeonFileRequestCache<PublicFileContent>();

  public constructor(
    private readonly publicFiles: PigeonPublicFilesClient,
    private readonly privateBlobs: Pick<PigeonPrivateBlobClient, 'download'>,
    private readonly cipher: AttachmentCipher,
    private readonly codec: AttachmentBinaryCodec,
  ) {}

  private async downloadEncrypted(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    if (!attachment.blobs?.length) {
      throw new PrivateBlobUnavailableError();
    }

    return await this.downloadPrivateBlobs(attachment, onProgress);
  }

  private async downloadPrivateBlobs(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    const blobs = [...(attachment.blobs ?? [])].sort(
      (left, right) => left.index - right.index,
    );
    const parts: PrivateBlobPart[] = [];

    for (let index = 0; index < blobs.length; index += 1) {
      const blob = blobs[index];
      const candidates: PrivateBlobCandidate[] = [
        {
          blobId: blob.blobId,
          downloadToken: blob.downloadToken,
          origin: blob.origin,
          size: blob.size,
        },
        ...(blob.alternates ?? [])
          .filter((alternate) => MailboxHomeBase.parse(alternate.origin))
          .map((alternate) => ({
            blobId: alternate.blobId,
            downloadToken: alternate.downloadToken,
            origin: alternate.origin,
            size: blob.size,
          })),
      ];

      parts.push(await this.fetchPart(candidates, 0));
      this.reportProgress(
        onProgress,
        attachment.filename,
        ((index + 1) * 100) / blobs.length,
      );
    }

    try {
      return await this.cipher.decrypt(
        attachment,
        this.codec.concatArrayBuffers(parts.map((part) => part.bytes)),
        onProgress,
      );
    } catch (failure) {
      if (parts.every((part) => part.candidates.length === 1)) {
        throw failure;
      }

      return await this.repairPrivateBlobs(
        attachment,
        parts,
        failure,
        onProgress,
      );
    }
  }

  private async fetchPart(
    candidates: PrivateBlobCandidate[],
    start: number,
  ): Promise<PrivateBlobPart> {
    if (candidates.length === 1) {
      return {
        bytes: await this.privateBlobs.download(candidates[0]),
        candidates,
        served: 0,
      };
    }

    for (let step = 0; step < candidates.length; step += 1) {
      const served = (start + step) % candidates.length;

      try {
        const bytes = await this.privateBlobs.download(candidates[served]);

        return { bytes, candidates, served };
      } catch {
        // Unavailable replica: try the next candidate in rotation.
      }
    }

    throw new PrivateBlobUnavailableError();
  }

  private async repairPrivateBlobs(
    attachment: MessageAttachment,
    parts: PrivateBlobPart[],
    failure: unknown,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    const { encryption } = attachment;

    if (!encryption) {
      throw failure;
    }

    const encryptedSize = parts.reduce(
      (total, part) => total + part.bytes.byteLength,
      0,
    );
    const chunks = encryption.chunks ?? [
      { iv: encryption.iv, size: encryptedSize },
    ];
    const aligned =
      chunks.length === parts.length &&
      parts.every(
        (part, index) => part.bytes.byteLength === chunks[index].size,
      );
    const failing = parts.flatMap((part, index) => {
      if (!aligned) {
        return [index];
      }

      try {
        this.cipher.decryptWithoutWorker(
          {
            ...attachment,
            encryption: {
              algorithm: encryption.algorithm,
              chunks: [chunks[index]],
              iv: encryption.iv,
              key: encryption.key,
            },
          },
          part.bytes,
        );

        return [];
      } catch {
        return [index];
      }
    });

    if (!failing.length) {
      throw failure;
    }

    const repaired = [...parts];

    for (const index of failing) {
      repaired[index] = await this.fetchPart(
        parts[index].candidates,
        parts[index].served + 1,
      );
    }

    try {
      return await this.cipher.decrypt(
        attachment,
        this.codec.concatArrayBuffers(repaired.map((part) => part.bytes)),
        onProgress,
      );
    } catch {
      throw new PrivateBlobUnavailableError();
    }
  }

  private async downloadPublic(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    if (!attachment.chunks?.length) {
      if (!attachment.cid) {
        throw new Error('Attachment is missing its content identifier');
      }
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
