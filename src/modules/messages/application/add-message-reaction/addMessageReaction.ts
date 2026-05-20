import type { AddMessageReactionPort } from '../ports/addMessageReactionPort';

import { AddMessageReactionMessage } from './messages/addMessageReactionMessage';

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
