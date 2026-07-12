import type { MessageLinkPreview } from '../../../../shared/domain/pigeonResources.types';
import type { CreateLinkPreviewPort } from './CreateLinkPreviewPort';

import { CreateLinkPreviewMessage } from './messages/CreateLinkPreviewMessage';

export class CreateLinkPreview {
  public constructor(private readonly links: CreateLinkPreviewPort) {}

  public async create(
    message: CreateLinkPreviewMessage,
  ): Promise<MessageLinkPreview> {
    return await this.links.createLinkPreview(
      message.getSession(),
      message.getUrl(),
    );
  }
}
