import { NetworkId } from '../../../domain/value-objects/networkId';
import { NetworkKey } from '../../../domain/value-objects/networkKey';
import { NetworkName } from '../../../domain/value-objects/networkName';

export class JoinNetworkMessage {
  private readonly id: NetworkId;
  private readonly key: NetworkKey;
  private readonly name: NetworkName;

  public constructor(input: { id: string; key: string; name: string }) {
    this.id = NetworkId.fromString(input.id);
    this.key = NetworkKey.fromString(input.key);
    this.name = NetworkName.fromString(input.name);
  }

  public getId(): NetworkId {
    return this.id;
  }

  public getKey(): NetworkKey {
    return this.key;
  }

  public getName(): NetworkName {
    return this.name;
  }
}
