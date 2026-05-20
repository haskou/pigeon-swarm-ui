import type {
  AttachmentProgress,
  MessageAttachment,
} from '../../../../shared/domain/pigeonResources.types';

import { pigeonApplication } from '../../../../app/composition/applicationContainer';

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
