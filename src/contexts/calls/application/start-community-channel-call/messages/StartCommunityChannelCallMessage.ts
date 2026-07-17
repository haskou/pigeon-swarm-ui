import { CallIdentityId } from '../../../domain/value-objects/CallIdentityId';
import { CallScope } from '../../../domain/value-objects/CallScope';
import { CallScopeIdentifier } from '../../../domain/value-objects/CallScopeIdentifier';

export class StartCommunityChannelCallMessage {
  public constructor(
    private readonly communityId: string,
    private readonly channelId: string,
    private readonly actorIdentityId: string,
  ) {}

  public getActorIdentityId(): CallIdentityId {
    return CallIdentityId.fromString(this.actorIdentityId);
  }

  public getScope(): CallScope {
    return CallScope.communityChannel(
      CallScopeIdentifier.fromString(this.communityId),
      CallScopeIdentifier.fromString(this.channelId),
    );
  }
}
