import type {
  AttachmentProgress,
  MessageAttachment,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';

export async function attachmentObjectUrl(
  attachment: MessageAttachment,
  onProgress?: (progress: AttachmentProgress) => void,
): Promise<string> {
  const blob = await pigeonApplication.downloadAttachment(
    attachment,
    onProgress,
  );

  return URL.createObjectURL(blob);
}
