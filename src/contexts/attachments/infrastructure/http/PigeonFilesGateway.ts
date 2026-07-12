import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  MessageAttachment,
  PendingMessageAttachment,
  PrivateFileContent,
  PrivateFileUpload,
  PublicFileContent,
  PublicFileUpload,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { PigeonFilesApi } from './PigeonFilesApi';

export class PigeonFilesGateway {
  public constructor(private readonly files: PigeonFilesApi) {}

  public async getPublicFile(cid: string): Promise<PublicFileContent> {
    return await this.files.getPublicFile(cid);
  }

  public async getPrivateFile(cid: string): Promise<PrivateFileContent> {
    return await this.files.getPrivateFile(cid);
  }

  public async uploadPublicFile(
    session: Session,
    file: File,
  ): Promise<PublicFileUpload> {
    return await this.files.uploadPublicFile(session, file);
  }

  public async uploadPrivateFile(
    session: Session,
    networkId: string,
    attachment: PendingMessageAttachment,
  ): Promise<PrivateFileUpload> {
    return await this.files.uploadPrivateFile(session, networkId, attachment);
  }

  public async downloadAttachment(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    return await this.files.downloadAttachment(attachment, onProgress);
  }

  public async publishMessageAttachments(
    session: Session,
    attachments: File[],
    onProgress?: (progress: AttachmentProgress) => void,
    options?: AttachmentUploadOptions,
  ): Promise<MessageAttachment[]> {
    return await this.files.publishMessageAttachments(
      session,
      attachments,
      onProgress,
      options,
    );
  }
}
