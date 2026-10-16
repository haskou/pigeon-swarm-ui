import { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';

export class FindNodeBlockPublicationMessage {
  public constructor(private readonly actorIdentityId: string) {}

  public getActorId(): NodeAccessActorId {
    return NodeAccessActorId.fromString(this.actorIdentityId);
  }
}
