import type { AddMessageReactionPort } from './AddMessageReactionPort';

import { AddMessageReactionMessage } from './messages/AddMessageReactionMessage';

export class AddMessageReaction {
  public constructor(private readonly messages: AddMessageReactionPort) {}

  public async add(message: AddMessageReactionMessage): Promise<void> {
    await this.messages.addMessageReaction(
      message.getSession(),
      message.getConversationId(),
      message.getMessageId(),
      message.getEmoji(),
    );
  }
}
