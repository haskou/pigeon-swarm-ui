import type { MessageAttachment } from '../../../../shared/domain/pigeonResources.types';

export type OriginalImageLoad =
  | { status: 'failed' }
  | { status: 'loaded'; url: string };

// Failures are returned as data, not swallowed, so the lightbox can say the
// full version is unavailable instead of presenting the preview as the original.
export async function loadOriginalImage(
  attachment: MessageAttachment,
  loadImage: (attachment: MessageAttachment) => Promise<string>,
): Promise<OriginalImageLoad> {
  try {
    return { status: 'loaded', url: await loadImage(attachment) };
  } catch {
    return { status: 'failed' };
  }
}
