import type { Session } from '../../../../../shared/domain/pigeonResources.types';

export class ListCallsMessage {
  public constructor(private readonly session: Session) {}

  public getSession(): Session {
    return this.session;
  }
}
