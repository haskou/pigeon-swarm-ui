import type {
  AttachmentProgress,
  MessageAttachment,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';

export async function attachmentObjectUrl(
  attachment: MessageAttachment,
  onProgress?: (progress: AttachmentProgress) => void,
): Promise<string> {
  if (attachment.localFile) {
    return URL.createObjectURL(attachment.localFile);
  }

  const blob = await applicationContainer.attachments.download(
    attachment,
    onProgress,
  );

  return URL.createObjectURL(blob);
}
