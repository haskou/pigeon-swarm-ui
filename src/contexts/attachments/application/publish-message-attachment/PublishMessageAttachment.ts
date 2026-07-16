import { Attachment } from '../../domain/Attachment';
import { AttachmentPublisher } from './AttachmentPublisher';
import { PublishMessageAttachmentMessage } from './messages/PublishMessageAttachmentMessage';

export class PublishMessageAttachment {
  public constructor(private readonly attachments: AttachmentPublisher) {}

  public async publish(
    message: PublishMessageAttachmentMessage,
  ): Promise<Attachment> {
    const attachment = message.getAttachment();
    const externalIdentifier = await this.attachments.publish(
      attachment,
      message.getSourceExternalIdentifier(),
      message.getPublisherIdentifier(),
    );

    attachment.publish(externalIdentifier, message.getOccurredAt());

    return attachment;
  }
}
