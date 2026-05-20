import type { Session } from '../../../../../shared/domain/pigeonResources.types';

export class ListCommunitiesMessage {
  public constructor(private readonly session: Session) {}

  public getSession(): Session {
    return this.session;
  }
}
