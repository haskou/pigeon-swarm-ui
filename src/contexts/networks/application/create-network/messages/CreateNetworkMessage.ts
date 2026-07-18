import { NetworkName } from '../../../domain/value-objects/NetworkName';
import { NetworkActorId } from '../../../domain/value-objects/NetworkActorId';

export class CreateNetworkMessage {
  public constructor(
    private readonly input: { actorIdentityId?: string; name: string },
  ) {}

  public getActorId(): NetworkActorId {
    return NetworkActorId.fromOptional(this.input.actorIdentityId);
  }

  public getName(): NetworkName {
    return NetworkName.fromString(this.input.name);
  }
}
