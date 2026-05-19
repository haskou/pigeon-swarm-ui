import type { MessageAttachment } from '../../domain/types';

export function attachmentBlobCacheKey(attachment: MessageAttachment): string {
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
        (chunk) => `${chunk.index}:${chunk.cid}:${chunk.sha256}:${chunk.size}`,
      )
      .join(',') ?? '',
  ].join('|');
}
