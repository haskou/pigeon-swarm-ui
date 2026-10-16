import { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';
import { NodeAccessIdentityId } from '../../../domain/value-objects/NodeAccessIdentityId';
import { NodeBlockSourceOrigin } from '../../../domain/value-objects/NodeBlockSourceOrigin';

export class FollowNodeBlockSourceMessage {
  public constructor(
    private readonly input: {
      actorIdentityId: string;
      autoApply: boolean;
      origin: string;
      sourceOwnerIdentityId: string;
    },
  ) {}

  public getActorId(): NodeAccessActorId {
    return NodeAccessActorId.fromString(this.input.actorIdentityId);
  }

  public getSourceOwnerIdentityId(): NodeAccessIdentityId {
    return NodeAccessIdentityId.fromString(this.input.sourceOwnerIdentityId);
  }

  public getOrigin(): NodeBlockSourceOrigin {
    return NodeBlockSourceOrigin.fromString(this.input.origin);
  }

  public isAutoApplied(): boolean {
    return this.input.autoApply;
  }
}
