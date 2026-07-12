import type { Session } from '../../../../../shared/domain/pigeonResources.types';

export class UnpinMessageMessage {
  public constructor(
    private readonly input: {
      conversationId: string;
      messageId: string;
      session: Session;
    },
  ) {}

  public getConversationId(): string {
    return this.input.conversationId;
  }

  public getMessageId(): string {
    return this.input.messageId;
  }

  public getSession(): Session {
    return this.input.session;
  }
}
