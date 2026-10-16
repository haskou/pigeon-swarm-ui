import { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';
import { NodeAccessIdentityId } from '../../../domain/value-objects/NodeAccessIdentityId';

export class UnfollowNodeBlockSourceMessage {
  public constructor(
    private readonly input: {
      actorIdentityId: string;
      sourceOwnerIdentityId: string;
    },
  ) {}

  public getActorId(): NodeAccessActorId {
    return NodeAccessActorId.fromString(this.input.actorIdentityId);
  }

  public getSourceOwnerIdentityId(): NodeAccessIdentityId {
    return NodeAccessIdentityId.fromString(this.input.sourceOwnerIdentityId);
  }
}
