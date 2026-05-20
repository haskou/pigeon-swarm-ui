import type { Session } from '../../../../../shared/domain/pigeonResources.types';

export class ListConversationsMessage {
  public constructor(private readonly session: Session) {}

  public getSession(): Session {
    return this.session;
  }
}
