import type { MessageAttachment } from '../../../../shared/domain/pigeonResources.types';

import { isBrowserPreviewImage } from '../../../../shared/presentation/isBrowserPreviewImage';

const largeAttachmentBytes = 50 * 1024 * 1024;
const imagePreviewBytes = 5 * 1024 * 1024;
const animatedImagePreviewBytes = 2 * 1024 * 1024;

export class MessageAttachmentPreview {
  public static isImage(attachment: MessageAttachment): boolean {
    if (MessageAttachmentPreview.isLargeOrChunked(attachment)) return false;

    if (!isBrowserPreviewImage(attachment.contentType)) return false;

    const previewLimit = MessageAttachmentPreview.isAnimatedImage(
      attachment.contentType,
    )
      ? animatedImagePreviewBytes
      : imagePreviewBytes;

    return attachment.size <= previewLimit;
  }

  public static isLargeOrChunked(attachment: MessageAttachment): boolean {
    return (
      attachment.type === 'chunked_file' ||
      !!attachment.chunks?.length ||
      attachment.size > largeAttachmentBytes
    );
  }

  private static isAnimatedImage(contentType: string): boolean {
    return ['image/apng', 'image/gif'].includes(contentType.toLowerCase());
  }
}
