import type {
  MessageResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

export class DecryptMessageMessage {
  public constructor(
    private readonly input: {
      conversationId: string;
      message: MessageResource;
      session: Session;
    },
  ) {}

  public getConversationId(): string {
    return this.input.conversationId;
  }

  public getMessage(): MessageResource {
    return this.input.message;
  }

  public getSession(): Session {
    return this.input.session;
  }
}
