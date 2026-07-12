import type { InviteToGroupConversationPort } from './InviteToGroupConversationPort';

import { InviteToGroupConversationMessage } from './messages/InviteToGroupConversationMessage';

export class InviteToGroupConversation {
  public constructor(
    private readonly conversations: InviteToGroupConversationPort,
  ) {}

  public async invite(
    message: InviteToGroupConversationMessage,
  ): Promise<void> {
    await this.conversations.inviteToGroupConversation(
      message.getSession(),
      message.getConversationId(),
      message.getRecipientIdentityId(),
    );
  }
}
