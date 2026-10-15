import { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';

export class FindNodeRegistrationMessage {
  public constructor(private readonly actorIdentityId: string) {}

  public getActorId(): NodeAccessActorId {
    return NodeAccessActorId.fromString(this.actorIdentityId);
  }
}
