import { UUID } from '@haskou/value-objects';

import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  MessageAttachment,
  PublicFileContent,
  PublicFileUpload,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { PrivateBlobReplicaPlanner } from './PrivateBlobReplicaPlanner';
import type { PrivateBlobReplicator } from './PrivateBlobReplicator';

import { AttachmentFinder } from '../../application/find-attachment/AttachmentFinder';
import { FindAttachmentMessage } from '../../application/find-attachment/messages/FindAttachmentMessage';
import { PublishMessageAttachmentMessage } from '../../application/publish-message-attachment/messages/PublishMessageAttachmentMessage';
import { PublishMessageAttachment } from '../../application/publish-message-attachment/PublishMessageAttachment';
import { AttachmentPublicationContexts } from './AttachmentPublicationContexts';
import { PigeonAttachmentDownloader } from './PigeonAttachmentDownloader';
import { PigeonPublicFileUploader } from './PigeonPublicFileUploader';
import { privateBlobRefsOf } from './privateBlobReference';

export class PigeonFilesGateway {
  public constructor(
    private readonly downloader: Pick<
      PigeonAttachmentDownloader,
      'download' | 'findPublic'
    >,
    private readonly publicFiles: Pick<PigeonPublicFileUploader, 'upload'>,
    private readonly publishAttachment: Pick<
      PublishMessageAttachment,
      'publish'
    >,
    private readonly findAttachment: Pick<AttachmentFinder, 'find'>,
    private readonly publicationContexts: AttachmentPublicationContexts,
    private readonly planner: Pick<PrivateBlobReplicaPlanner, 'plan'>,
    private readonly replicator: Pick<
      PrivateBlobReplicator,
      'abandon' | 'settle'
    >,
  ) {}

  public async download(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    return await this.downloader.download(attachment, onProgress);
  }

  public async getPublicFile(cid: string): Promise<PublicFileContent> {
    const attachment = await this.findAttachment.find(
      new FindAttachmentMessage(cid, false),
    );

    return await this.downloader.findPublic(
      attachment.getPublishedExternalIdentifier().toString(),
    );
  }

  public async publish(
    session: Session,
    attachments: File[],
    onProgress?: (progress: AttachmentProgress) => void,
    options?: AttachmentUploadOptions,
  ): Promise<MessageAttachment[]> {
    const published: MessageAttachment[] = [];
    const planned = await this.planner.plan(options?.recipientIdentityId);
    const origins: (string | undefined)[] =
      planned.length > 0 ? planned : [undefined];

    try {
      for (const file of attachments) {
        const id = UUID.generate().toString();
        const sourceExternalIdentifier = UUID.generate().toString();

        this.publicationContexts.register(
          sourceExternalIdentifier,
          session.identity.id,
          { file, onProgress, origins, session },
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
    } catch (error) {
      await this.replicator.abandon(session, privateBlobRefsOf(published));
      throw error;
    }

    return published;
  }

  public settleMessageAttachments(
    session: Session,
    attachments: MessageAttachment[],
  ): void {
    this.replicator.settle(session, privateBlobRefsOf(attachments));
  }

  public async abandonMessageAttachments(
    session: Session,
    attachments: MessageAttachment[],
  ): Promise<void> {
    await this.replicator.abandon(session, privateBlobRefsOf(attachments));
  }

  public async publishMessageAttachments(
    session: Session,
    attachments: File[],
    onProgress?: (progress: AttachmentProgress) => void,
    options?: AttachmentUploadOptions,
  ): Promise<MessageAttachment[]> {
    return await this.publish(session, attachments, onProgress, options);
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
