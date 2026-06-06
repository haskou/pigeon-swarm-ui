import type { MessageAttachment } from '../../../../shared/domain/pigeonResources.types';
import type { PublishMessageAttachmentsPort } from '../ports/PublishMessageAttachmentsPort';

import { PublishMessageAttachmentsMessage } from './messages/PublishMessageAttachmentsMessage';

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
