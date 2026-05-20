import { NetworkName } from '../../../domain/value-objects/NetworkName';

export class CreateNetworkMessage {
  private readonly name: NetworkName;

  public constructor(name: string) {
    this.name = NetworkName.fromString(name);
  }

  public getName(): NetworkName {
    return this.name;
  }
}
