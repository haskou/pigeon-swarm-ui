import { NetworkActorId } from '../../../domain/value-objects/NetworkActorId';

export class FindNodeRelayConfigurationMessage {
  public constructor(private readonly actorIdentityId?: string) {}

  public getActorId(): NetworkActorId {
    return NetworkActorId.fromOptional(this.actorIdentityId);
  }
}
