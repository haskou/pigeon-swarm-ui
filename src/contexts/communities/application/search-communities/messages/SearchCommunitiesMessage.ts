import { CommunityIdentityId } from '../../../domain/value-objects/CommunityIdentityId';

export class SearchCommunitiesMessage {
  public constructor(private readonly actorIdentityId: string) {}

  public getActorIdentityId(): CommunityIdentityId {
    return CommunityIdentityId.fromString(this.actorIdentityId);
  }
}
