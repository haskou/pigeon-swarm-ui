import type {
  AttachmentProgress,
  MessageAttachment,
} from '../../../../shared/domain/pigeonResources.types';

export interface DownloadAttachmentPort {
  downloadAttachment(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob>;
}
