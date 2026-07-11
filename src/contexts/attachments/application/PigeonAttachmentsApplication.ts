import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  MessageAttachment,
  PublicFileContent,
  PublicFileUpload,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { AttachmentApplicationPort } from './ports/AttachmentApplicationPort';

import { PublishMessageAttachmentsMessage } from './publish-message-attachments/messages/PublishMessageAttachmentsMessage';
import { PublishMessageAttachments } from './publish-message-attachments/PublishMessageAttachments';

export class PigeonAttachmentsApplication {
  private readonly publishMessageAttachments: PublishMessageAttachments;

  public constructor(private readonly gateway: AttachmentApplicationPort) {
    this.publishMessageAttachments = new PublishMessageAttachments({
      publish: async (message) =>
        await gateway.publishMessageAttachments(
          message.getSession(),
          message.getAttachments(),
          message.getProgressReporter(),
          message.getOptions(),
        ),
    });
  }

  public async download(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    return await this.gateway.downloadAttachment(attachment, onProgress);
  }

  public async getPublicFile(cid: string): Promise<PublicFileContent> {
    return await this.gateway.getPublicFile(cid);
  }

  public async publish(
    session: Session,
    attachments: File[],
    onProgress?: (progress: AttachmentProgress) => void,
    options?: AttachmentUploadOptions,
  ): Promise<MessageAttachment[]> {
    return await this.publishMessageAttachments.publish(
      new PublishMessageAttachmentsMessage({
        attachments,
        onProgress,
        options,
        session,
      }),
    );
  }

  public async uploadPublic(
    session: Session,
    file: File,
  ): Promise<PublicFileUpload> {
    return await this.gateway.uploadPublicFile(session, file);
  }
}
