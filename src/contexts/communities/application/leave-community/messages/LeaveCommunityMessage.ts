import type { Session } from '../../../../../shared/domain/pigeonResources.types';

export class LeaveCommunityMessage {
  public constructor(
    private readonly session: Session,
    private readonly communityId: string,
  ) {}

  public getCommunityId(): string {
    return this.communityId;
  }

  public getSession(): Session {
    return this.session;
  }
}
