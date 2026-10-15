import { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';

export class ChangeNodeBlockPublicationMessage {
  public constructor(
    private readonly input: { actorIdentityId: string; published: boolean },
  ) {}

  public getActorId(): NodeAccessActorId {
    return NodeAccessActorId.fromString(this.input.actorIdentityId);
  }

  public isPublished(): boolean {
    return this.input.published;
  }
}
