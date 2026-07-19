import { NetworkActorId } from '../../../domain/value-objects/NetworkActorId';
import { NetworkId } from '../../../domain/value-objects/NetworkId';
import { NetworkKey } from '../../../domain/value-objects/NetworkKey';
import { NetworkName } from '../../../domain/value-objects/NetworkName';

export class JoinNetworkMessage {
  public constructor(
    private readonly input: {
      actorIdentityId?: string;
      id: string;
      key: string;
      name: string;
    },
  ) {}

  public getActorId(): NetworkActorId {
    return NetworkActorId.fromOptional(this.input.actorIdentityId);
  }

  public getId(): NetworkId {
    return NetworkId.fromString(this.input.id);
  }

  public getKey(): NetworkKey {
    return NetworkKey.fromString(this.input.key);
  }

  public getName(): NetworkName {
    return NetworkName.fromString(this.input.name);
  }
}
