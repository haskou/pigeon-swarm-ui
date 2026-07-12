import type { Session } from '../../../../../shared/domain/pigeonResources.types';

export class DeleteConversationDraftMessage {
  public constructor(
    private readonly input: { conversationId: string; session: Session },
  ) {}

  public getConversationId(): string {
    return this.input.conversationId;
  }

  public getSession(): Session {
    return this.input.session;
  }
}
