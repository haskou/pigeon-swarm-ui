import type {
  SendMessageOptions,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

export class SendMessageMessage {
  public constructor(
    private readonly input: {
      content: string;
      conversationId: string;
      options?: SendMessageOptions;
      session: Session;
    },
  ) {}

  public getContent(): string {
    return this.input.content;
  }

  public getConversationId(): string {
    return this.input.conversationId;
  }

  public getOptions(): SendMessageOptions {
    return this.input.options ?? {};
  }

  public getSession(): Session {
    return this.input.session;
  }
}
