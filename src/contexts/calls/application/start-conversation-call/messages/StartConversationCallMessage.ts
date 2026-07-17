import { CallIdentityId } from '../../../domain/value-objects/CallIdentityId';
import { CallScope } from '../../../domain/value-objects/CallScope';
import { CallScopeIdentifier } from '../../../domain/value-objects/CallScopeIdentifier';

export class StartConversationCallMessage {
  public constructor(
    private readonly conversationId: string,
    private readonly actorIdentityId: string,
  ) {}

  public getActorIdentityId(): CallIdentityId {
    return CallIdentityId.fromString(this.actorIdentityId);
  }

  public getScope(): CallScope {
    return CallScope.conversation(
      CallScopeIdentifier.fromString(this.conversationId),
    );
  }
}
