import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  MessageAttachment,
  PublicFileContent,
  PublicFileUpload,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface AttachmentApplicationPort {
  downloadAttachment(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob>;
  getPublicFile(cid: string): Promise<PublicFileContent>;
  publishMessageAttachments(
    session: Session,
    attachments: File[],
    onProgress?: (progress: AttachmentProgress) => void,
    options?: AttachmentUploadOptions,
  ): Promise<MessageAttachment[]>;
  uploadPublicFile(session: Session, file: File): Promise<PublicFileUpload>;
}
