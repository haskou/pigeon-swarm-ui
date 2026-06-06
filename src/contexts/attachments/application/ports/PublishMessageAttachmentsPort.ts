import type { MessageAttachment } from '../../../../shared/domain/pigeonResources.types';
import type { PublishMessageAttachmentsMessage } from '../publish-message-attachments/messages/PublishMessageAttachmentsMessage';

export interface PublishMessageAttachmentsPort {
  publish(
    message: PublishMessageAttachmentsMessage,
  ): Promise<MessageAttachment[]>;
}
