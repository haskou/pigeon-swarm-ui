import { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';
import { NodeAccessIdentityId } from '../../../domain/value-objects/NodeAccessIdentityId';

export class FindNodeBlockListMessage {
  public constructor(private readonly input: { actorIdentityId: string }) {}

  public getActorId(): NodeAccessActorId {
    return NodeAccessActorId.fromString(this.input.actorIdentityId);
  }

  /** Only the node owner signs block lists, so the actor is the owner. */
  public getOwnerIdentityId(): NodeAccessIdentityId {
    return NodeAccessIdentityId.fromString(this.input.actorIdentityId);
  }
}
