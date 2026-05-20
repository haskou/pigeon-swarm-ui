import type { RemoveMessageReactionPort } from '../ports/removeMessageReactionPort';

import { RemoveMessageReactionMessage } from './messages/removeMessageReactionMessage';

export class RemoveMessageReaction {
  public constructor(private readonly messages: RemoveMessageReactionPort) {}

  public async remove(message: RemoveMessageReactionMessage): Promise<void> {
    await this.messages.removeMessageReaction(
      message.getSession(),
      message.getConversationId(),
      message.getMessageId(),
      message.getEmoji(),
    );
  }
}
