import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  MessageAttachment,
  PublicFileContent,
  PublicFileUpload,
} from '../../contexts/attachments/infrastructure/attachmentResources.types';
import type { PigeonFilesGateway } from '../../contexts/attachments/infrastructure/http/PigeonFilesGateway';
import type { Session } from '../../contexts/identities/domain/Session';

export class PigeonAttachmentsFacade {
  public constructor(
    private readonly files: Pick<
      PigeonFilesGateway,
      'download' | 'getPublicFile' | 'publish' | 'uploadPublic'
    >,
  ) {}

  public async download(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    return await this.files.download(attachment, onProgress);
  }

  public async getPublicFile(cid: string): Promise<PublicFileContent> {
    return await this.files.getPublicFile(cid);
  }

  public async publish(
    session: Session,
    attachments: File[],
    onProgress?: (progress: AttachmentProgress) => void,
    options?: AttachmentUploadOptions,
  ): Promise<MessageAttachment[]> {
    return await this.files.publish(session, attachments, onProgress, options);
  }

  public async uploadPublic(
    session: Session,
    file: File,
  ): Promise<PublicFileUpload> {
    return await this.files.uploadPublic(session, file);
  }
}
