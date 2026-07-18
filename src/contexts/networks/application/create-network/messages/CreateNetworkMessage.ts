import { NetworkActorId } from '../../../domain/value-objects/NetworkActorId';
import { NetworkName } from '../../../domain/value-objects/NetworkName';

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
