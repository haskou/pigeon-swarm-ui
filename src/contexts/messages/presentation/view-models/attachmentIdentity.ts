import type { MessageAttachment } from '../../../../shared/domain/pigeonResources.types';

/**
 * Stable per-attachment identity for React keys and grouping. Public
 * attachments use their CID; private blob attachments have no CID and use the
 * first blob id, which is unique per upload.
 */
export function attachmentIdentity(attachment: MessageAttachment): string {
  return attachment.cid ?? attachment.blobs?.[0]?.blobId ?? attachment.filename;
}
