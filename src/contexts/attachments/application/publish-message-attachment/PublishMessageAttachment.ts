import { Attachment } from '../../domain/Attachment';
import { AttachmentRepository } from '../../domain/repositories/AttachmentRepository';
import { PublishMessageAttachmentMessage } from './messages/PublishMessageAttachmentMessage';

export class PublishMessageAttachment {
  public constructor(
    private readonly attachmentRepository: AttachmentRepository,
  ) {}

  public async publish(
    message: PublishMessageAttachmentMessage,
  ): Promise<Attachment> {
    const attachment = message.getAttachment();
    const externalIdentifier = await this.attachmentRepository.create(
      attachment,
      message.getSourceExternalIdentifier(),
      message.getPublisherIdentifier(),
    );

    attachment.publish(externalIdentifier, message.getOccurredAt());

    return attachment;
  }
}
