import type { MessageAttachment } from '../../../../shared/domain/pigeonResources.types';
import type { PublishMessageAttachmentsPort } from '../ports/publishMessageAttachmentsPort';

import { PublishMessageAttachmentsMessage } from './messages/publishMessageAttachmentsMessage';

export class PublishMessageAttachments {
  public constructor(
    private readonly attachments: PublishMessageAttachmentsPort,
  ) {}

  public async publish(
    message: PublishMessageAttachmentsMessage,
  ): Promise<MessageAttachment[]> {
    return await this.attachments.publish(message);
  }
}
