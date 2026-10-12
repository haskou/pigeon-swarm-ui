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
  settleMessageAttachments(
    session: Session,
    attachments: MessageAttachment[],
  ): void;
  abandonMessageAttachments(
    session: Session,
    attachments: MessageAttachment[],
  ): Promise<void>;
}
