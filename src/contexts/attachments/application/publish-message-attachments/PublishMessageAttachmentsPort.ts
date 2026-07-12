import type { MessageAttachment } from '../../../../shared/domain/pigeonResources.types';
import type { PublishMessageAttachmentsMessage } from './messages/PublishMessageAttachmentsMessage';

export interface PublishMessageAttachmentsPort {
  publish(
    message: PublishMessageAttachmentsMessage,
  ): Promise<MessageAttachment[]>;
}
