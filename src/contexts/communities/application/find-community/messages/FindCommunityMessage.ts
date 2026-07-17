import { CommunityId } from '../../../domain/value-objects/CommunityId';
import { CommunityIdentityId } from '../../../domain/value-objects/CommunityIdentityId';

export class FindCommunityMessage {
  public constructor(
    private readonly communityId: string,
    private readonly actorIdentityId: string,
  ) {}

  public getActorIdentityId(): CommunityIdentityId {
    return CommunityIdentityId.fromString(this.actorIdentityId);
  }

  public getCommunityId(): CommunityId {
    return CommunityId.fromString(this.communityId);
  }
}
