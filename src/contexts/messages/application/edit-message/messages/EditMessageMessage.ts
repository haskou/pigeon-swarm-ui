import type {
  EditMessageOptions,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

export class EditMessageMessage {
  public constructor(
    private readonly input: {
      content: string;
      conversationId: string;
      messageId: string;
      options?: EditMessageOptions;
      session: Session;
    },
  ) {}

  public getContent(): string {
    return this.input.content;
  }

  public getConversationId(): string {
    return this.input.conversationId;
  }

  public getMessageId(): string {
    return this.input.messageId;
  }

  public getOptions(): EditMessageOptions {
    return this.input.options ?? {};
  }

  public getSession(): Session {
    return this.input.session;
  }
}
