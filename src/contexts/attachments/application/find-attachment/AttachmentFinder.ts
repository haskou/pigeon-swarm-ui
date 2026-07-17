import type { Attachment } from '../../domain/Attachment';
import type { AttachmentRepository } from '../../domain/repositories/AttachmentRepository';

import { FindAttachmentMessage } from './messages/FindAttachmentMessage';

export class AttachmentFinder {
  public constructor(
    private readonly attachmentRepository: AttachmentRepository,
  ) {}

  public async find(message: FindAttachmentMessage): Promise<Attachment> {
    return await this.attachmentRepository.find(
      message.getExternalIdentifier(),
      message.getPublicationStrategy(),
    );
  }
}
