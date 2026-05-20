import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

export class PublishMessageAttachmentsMessage {
  public constructor(
    private readonly input: {
      attachments: File[];
      onProgress?: (progress: AttachmentProgress) => void;
      options?: AttachmentUploadOptions;
      session: Session;
    },
  ) {}

  public getAttachments(): File[] {
    return this.input.attachments;
  }

  public getOptions(): AttachmentUploadOptions | undefined {
    return this.input.options;
  }

  public getProgressReporter():
    | ((progress: AttachmentProgress) => void)
    | undefined {
    return this.input.onProgress;
  }

  public getSession(): Session {
    return this.input.session;
  }
}
