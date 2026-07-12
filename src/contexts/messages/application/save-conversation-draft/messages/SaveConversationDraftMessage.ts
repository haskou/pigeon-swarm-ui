import type { Session } from '../../../../../shared/domain/pigeonResources.types';

export class SaveConversationDraftMessage {
  public constructor(
    private readonly input: {
      content: string;
      conversationId: string;
      session: Session;
      updatedAt?: number;
    },
  ) {}

  public getContent(): string {
    return this.input.content;
  }

  public getConversationId(): string {
    return this.input.conversationId;
  }

  public getSession(): Session {
    return this.input.session;
  }

  public getUpdatedAt(): number | undefined {
    return this.input.updatedAt;
  }
}
