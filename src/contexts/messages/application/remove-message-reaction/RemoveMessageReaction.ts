import type { RemoveMessageReactionPort } from './RemoveMessageReactionPort';

import { RemoveMessageReactionMessage } from './messages/RemoveMessageReactionMessage';

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
