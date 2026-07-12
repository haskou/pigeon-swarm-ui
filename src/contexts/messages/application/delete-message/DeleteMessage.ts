import type { DeleteMessagePort } from './DeleteMessagePort';

import { DeleteMessageMessage } from './messages/DeleteMessageMessage';

export class DeleteMessage {
  public constructor(private readonly messages: DeleteMessagePort) {}

  public async delete(message: DeleteMessageMessage): Promise<void> {
    await this.messages.deleteMessage(
      message.getSession(),
      message.getConversationId(),
      message.getMessageId(),
    );
  }
}
