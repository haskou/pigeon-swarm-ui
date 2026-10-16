import { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';
import { NodeRegistrationMode } from '../../../domain/value-objects/NodeRegistrationMode';

export class ChangeNodeRegistrationModeMessage {
  public constructor(
    private readonly input: { actorIdentityId: string; mode: string },
  ) {}

  public getActorId(): NodeAccessActorId {
    return NodeAccessActorId.fromString(this.input.actorIdentityId);
  }

  public getMode(): NodeRegistrationMode {
    return NodeRegistrationMode.fromPrimitives(this.input.mode);
  }
}
