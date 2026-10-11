import { useCallback } from 'react';

import type {
  AttachmentProgress,
  MessageAttachment,
} from '../../../../shared/domain/pigeonResources.types';

import { attachmentDownloadErrorMessage } from '../view-models/attachmentDownloadErrorMessage';
import { attachmentObjectUrl } from '../view-models/attachmentObjectUrl';

interface UseAttachmentDownloadInput {
  errorMessage: string;
  unavailableMessage: string;
  onErrorChange: (message: string | null) => void;
  onProgressChange: (progress: AttachmentProgress | null) => void;
}

export function useAttachmentDownload({
  errorMessage,
  unavailableMessage,
  onErrorChange,
  onProgressChange,
}: UseAttachmentDownloadInput) {
  const loadAttachmentPreview = useCallback(
    async (
      attachment: MessageAttachment,
      onProgress?: (progress: AttachmentProgress) => void,
    ): Promise<string> => {
      return await attachmentObjectUrl(attachment, onProgress);
    },
    [],
  );

  const openAttachment = useCallback(
    async (attachment?: MessageAttachment): Promise<void> => {
      if (!attachment) return;

      onErrorChange(null);
      onProgressChange(null);
      try {
        const url = await loadAttachmentPreview(attachment, onProgressChange);
        const link = document.createElement('a');

        onErrorChange(null);
        onProgressChange(null);
        link.href = url;
        link.download = attachment.filename;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      } catch (error) {
        onProgressChange(null);
        onErrorChange(
          attachmentDownloadErrorMessage(error, {
            errorMessage,
            unavailableMessage,
          }),
        );
      }
    },
    [
      errorMessage,
      loadAttachmentPreview,
      onErrorChange,
      onProgressChange,
      unavailableMessage,
    ],
  );

  return { loadAttachmentPreview, openAttachment };
}
