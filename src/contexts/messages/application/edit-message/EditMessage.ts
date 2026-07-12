import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import type { EditMessagePort } from './EditMessagePort';

import { EditMessageMessage } from './messages/EditMessageMessage';

export class EditMessage {
  public constructor(private readonly messages: EditMessagePort) {}

  public async edit(message: EditMessageMessage): Promise<ChatMessage> {
    return await this.messages.editMessage(
      message.getSession(),
      message.getConversationId(),
      message.getMessageId(),
      message.getContent(),
      message.getOptions(),
    );
  }
}
