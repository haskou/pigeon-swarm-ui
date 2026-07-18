import { NetworkActorId } from '../../../domain/value-objects/NetworkActorId';
import { NetworkNodeOwnerId } from '../../../domain/value-objects/NetworkNodeOwnerId';

export class ClaimNetworkNodeMessage {
  public constructor(private readonly actorIdentityId: string) {}

  public getActorId(): NetworkActorId {
    return NetworkActorId.fromOptional(this.actorIdentityId);
  }

  public getOwnerId(): NetworkNodeOwnerId {
    return NetworkNodeOwnerId.fromString(this.actorIdentityId);
  }
}
