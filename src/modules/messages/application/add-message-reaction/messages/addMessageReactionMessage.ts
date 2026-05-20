import type { Session } from '../../../../../shared/domain/pigeonResources.types';

export class AddMessageReactionMessage {
  public constructor(
    private readonly input: {
      conversationId: string;
      emoji: string;
      messageId: string;
      session: Session;
    },
  ) {}

  public getConversationId(): string {
    return this.input.conversationId;
  }

  public getEmoji(): string {
    return this.input.emoji;
  }

  public getMessageId(): string {
    return this.input.messageId;
  }

  public getSession(): Session {
    return this.input.session;
  }
}
