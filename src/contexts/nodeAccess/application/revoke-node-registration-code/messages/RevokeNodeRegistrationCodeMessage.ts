import { NodeAccessActorId } from '../../../domain/value-objects/NodeAccessActorId';
import { NodeRegistrationCodeId } from '../../../domain/value-objects/NodeRegistrationCodeId';

export class RevokeNodeRegistrationCodeMessage {
  public constructor(
    private readonly input: { actorIdentityId: string; codeId: string },
  ) {}

  public getActorId(): NodeAccessActorId {
    return NodeAccessActorId.fromString(this.input.actorIdentityId);
  }

  public getCodeId(): NodeRegistrationCodeId {
    return NodeRegistrationCodeId.fromString(this.input.codeId);
  }
}
