import { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';
import { NodeBlockTarget } from '../../../domain/value-objects/NodeBlockTarget';

export class RemoveNodeBlockExceptionMessage {
  public constructor(
    private readonly input: {
      actorIdentityId: string;
      identityId?: string;
      nodePeerId?: string;
    },
  ) {}

  public getActorId(): NodeAccessActorId {
    return NodeAccessActorId.fromString(this.input.actorIdentityId);
  }

  public getTarget(): NodeBlockTarget {
    return NodeBlockTarget.fromPrimitives(this.input);
  }
}
