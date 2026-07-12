import type { MarkConversationReadUntilPort } from './MarkConversationReadUntilPort';

import { MarkConversationReadUntilMessage } from './messages/MarkConversationReadUntilMessage';

export class MarkConversationReadUntil {
  public constructor(
    private readonly conversations: MarkConversationReadUntilPort,
  ) {}

  public async mark(message: MarkConversationReadUntilMessage): Promise<void> {
    await this.conversations.markConversationReadUntil(
      message.getSession(),
      message.getConversationId(),
      message.getMessageId(),
    );
  }
}
