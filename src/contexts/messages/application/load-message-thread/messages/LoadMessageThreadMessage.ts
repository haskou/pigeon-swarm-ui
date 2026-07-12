import type { Session } from '../../../../../shared/domain/pigeonResources.types';

export class LoadMessageThreadMessage {
  public constructor(
    private readonly input: {
      conversationId: string;
      messageId: string;
      options?: { limit?: number };
      session: Session;
    },
  ) {}

  public getConversationId(): string {
    return this.input.conversationId;
  }

  public getMessageId(): string {
    return this.input.messageId;
  }

  public getOptions(): { limit?: number } {
    return this.input.options ?? {};
  }

  public getSession(): Session {
    return this.input.session;
  }
}
