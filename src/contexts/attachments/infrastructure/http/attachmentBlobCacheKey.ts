import type { MessageAttachment } from '../../../../shared/domain/pigeonResources.types';

function joinParts<T>(
  parts: T[] | undefined,
  format: (part: T) => string,
): string {
  return parts?.map(format).join(',') ?? '';
}

/** Cache identity for content. Download tokens are never part of the key. */
export function attachmentBlobCacheKey(attachment: MessageAttachment): string {
  return [
    attachment.cid ?? '',
    attachment.encrypted === false ? 'public' : 'encrypted',
    attachment.encryptedSize,
    attachment.size,
    attachment.contentType,
    attachment.encryption?.algorithm ?? '',
    attachment.encryption?.key ?? '',
    attachment.encryption?.iv ?? '',
    joinParts(
      attachment.encryption?.chunks,
      (chunk) => `${chunk.iv}:${chunk.size}`,
    ),
    joinParts(
      attachment.blobs,
      (blob) => `${blob.index}:${blob.blobId}:${blob.size}`,
    ),
    joinParts(
      attachment.chunks,
      (chunk) => `${chunk.index}:${chunk.cid}:${chunk.sha256}:${chunk.size}`,
    ),
  ].join('|');
}
