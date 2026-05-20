import type { Session } from '../../../../../domain/types';

export class ListNotificationsMessage {
  public constructor(private readonly session: Session) {}

  public getSession(): Session {
    return this.session;
  }
}
