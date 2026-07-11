import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  MessageAttachment,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface MessageAttachmentPublisher {
  publishMessageAttachments(
    session: Session,
    attachments: File[],
    onProgress?: (progress: AttachmentProgress) => void,
    options?: AttachmentUploadOptions,
  ): Promise<MessageAttachment[]>;
}
