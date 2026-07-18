import { NetworkActorId } from '../../../domain/value-objects/NetworkActorId';

export class ListNodeNetworksMessage {
  public constructor(private readonly actorIdentityId?: string) {}

  public getActorId(): NetworkActorId {
    return NetworkActorId.fromOptional(this.actorIdentityId);
  }
}
