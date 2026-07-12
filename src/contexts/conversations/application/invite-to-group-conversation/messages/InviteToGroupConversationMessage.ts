import type { Session } from '../../../../../shared/domain/pigeonResources.types';

export class InviteToGroupConversationMessage {
  public constructor(
    private readonly input: {
      conversationId: string;
      recipientIdentityId: string;
      session: Session;
    },
  ) {}

  public getConversationId(): string {
    return this.input.conversationId;
  }

  public getRecipientIdentityId(): string {
    return this.input.recipientIdentityId;
  }

  public getSession(): Session {
    return this.input.session;
  }
}
