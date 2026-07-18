import { NetworkActorId } from '../../../domain/value-objects/NetworkActorId';
import { NetworkId } from '../../../domain/value-objects/NetworkId';

export class RemoveNodeNetworkMessage {
  public constructor(
    private readonly input: {
      actorIdentityId?: string;
      networkId: string;
    },
  ) {}

  public getActorId(): NetworkActorId {
    return NetworkActorId.fromOptional(this.input.actorIdentityId);
  }

  public getNetworkId(): NetworkId {
    return NetworkId.fromString(this.input.networkId);
  }
}
