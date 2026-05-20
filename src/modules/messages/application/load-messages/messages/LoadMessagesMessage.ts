import type { Session } from '../../../../../shared/domain/pigeonResources.types';

export class LoadMessagesMessage {
  public constructor(
    private readonly input: {
      before?: null | string;
      conversationId: string;
      options?: { signal?: AbortSignal };
      session: Session;
    },
  ) {}

  public getBefore(): null | string | undefined {
    return this.input.before;
  }

  public getConversationId(): string {
    return this.input.conversationId;
  }

  public getOptions(): { signal?: AbortSignal } | undefined {
    return this.input.options;
  }

  public getSession(): Session {
    return this.input.session;
  }
}
