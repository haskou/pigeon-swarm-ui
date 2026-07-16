import { UUID } from '@haskou/value-objects';

import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  MessageAttachment,
  PrivateFileContent,
  PrivateFileUpload,
  PublicFileContent,
  PublicFileUpload,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { PendingMessageAttachment } from '../crypto/resources/PendingMessageAttachment';

import { PublishMessageAttachmentMessage } from '../../application/publish-message-attachment/messages/PublishMessageAttachmentMessage';
import { PublishMessageAttachment } from '../../application/publish-message-attachment/PublishMessageAttachment';
import { AttachmentPublicationContexts } from './AttachmentPublicationContexts';
import { PigeonAttachmentDownloader } from './PigeonAttachmentDownloader';
import { PigeonPrivateFilesClient } from './PigeonPrivateFilesClient';
import { PigeonPublicFileUploader } from './PigeonPublicFileUploader';

export class PigeonFilesGateway {
  public constructor(
    private readonly downloader: Pick<
      PigeonAttachmentDownloader,
      'download' | 'findPrivate' | 'findPublic'
    >,
    private readonly privateFiles: Pick<PigeonPrivateFilesClient, 'upload'>,
    private readonly publicFiles: Pick<PigeonPublicFileUploader, 'upload'>,
    private readonly publishAttachment: Pick<
      PublishMessageAttachment,
      'publish'
    >,
    private readonly publicationContexts: AttachmentPublicationContexts,
  ) {}

  public async download(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    return await this.downloader.download(attachment, onProgress);
  }

  public async downloadAttachment(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    return await this.download(attachment, onProgress);
  }

  public async getPrivateFile(cid: string): Promise<PrivateFileContent> {
    return await this.downloader.findPrivate(cid);
  }

  public async getPublicFile(cid: string): Promise<PublicFileContent> {
    return await this.downloader.findPublic(cid);
  }

  public async publish(
    session: Session,
    attachments: File[],
    onProgress?: (progress: AttachmentProgress) => void,
    options?: AttachmentUploadOptions,
  ): Promise<MessageAttachment[]> {
    const published: MessageAttachment[] = [];

    for (const file of attachments) {
      const id = UUID.generate().toString();
      const sourceExternalIdentifier = UUID.generate().toString();

      this.publicationContexts.register(
        sourceExternalIdentifier,
        session.identity.id,
        { file, onProgress, session },
      );

      try {
        await this.publishAttachment.publish(
          new PublishMessageAttachmentMessage({
            contentType: file.type || 'application/octet-stream',
            encryptLargeAttachments: options?.encryptLargeAttachments,
            encryptSmallAttachments: options?.encryptSmallAttachments,
            filename: file.name || 'attachment',
            id,
            networkId: options?.networkId,
            occurredAt: Date.now(),
            publisherExternalIdentifier: session.identity.id,
            size: file.size,
            sourceExternalIdentifier,
          }),
        );

        published.push(
          this.publicationContexts.takePublished(sourceExternalIdentifier),
        );
      } finally {
        this.publicationContexts.discard(sourceExternalIdentifier);
      }
    }

    return published;
  }

  public async publishMessageAttachments(
    session: Session,
    attachments: File[],
    onProgress?: (progress: AttachmentProgress) => void,
    options?: AttachmentUploadOptions,
  ): Promise<MessageAttachment[]> {
    return await this.publish(session, attachments, onProgress, options);
  }

  public async uploadPrivateFile(
    session: Session,
    networkId: string,
    attachment: PendingMessageAttachment,
  ): Promise<PrivateFileUpload> {
    return await this.privateFiles.upload(
      session,
      networkId,
      attachment.encryptedBytes,
      attachment.uploadFilename,
    );
  }

  public async uploadPublic(
    session: Session,
    file: File,
  ): Promise<PublicFileUpload> {
    return await this.publicFiles.upload(session, file);
  }

  public async uploadPublicFile(
    session: Session,
    file: File,
  ): Promise<PublicFileUpload> {
    return await this.uploadPublic(session, file);
  }
}
