import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  MessageAttachment,
  PublicFileContent,
  PublicFileUpload,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { DownloadAttachmentPort } from './download-attachment/DownloadAttachmentPort';
import type { GetPublicFilePort } from './get-public-file/GetPublicFilePort';
import type { PublishMessageAttachmentsPort } from './publish-message-attachments/PublishMessageAttachmentsPort';
import type { UploadPublicFilePort } from './upload-public-file/UploadPublicFilePort';

import { PublishMessageAttachmentsMessage } from './publish-message-attachments/messages/PublishMessageAttachmentsMessage';
import { PublishMessageAttachments } from './publish-message-attachments/PublishMessageAttachments';

export class PigeonAttachmentsApplication {
  private readonly publishMessageAttachments: PublishMessageAttachments;

  public constructor(
    private readonly dependencies: {
      downloadAttachment: DownloadAttachmentPort;
      getPublicFile: GetPublicFilePort;
      publishMessageAttachments: PublishMessageAttachmentsPort;
      uploadPublicFile: UploadPublicFilePort;
    },
  ) {
    this.publishMessageAttachments = new PublishMessageAttachments({
      publish: async (message) =>
        await dependencies.publishMessageAttachments.publish(message),
    });
  }

  public async download(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    return await this.dependencies.downloadAttachment.downloadAttachment(
      attachment,
      onProgress,
    );
  }

  public async getPublicFile(cid: string): Promise<PublicFileContent> {
    return await this.dependencies.getPublicFile.getPublicFile(cid);
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
    return await this.dependencies.uploadPublicFile.uploadPublicFile(
      session,
      file,
    );
  }
}
