import type { PrimitiveOf } from '@haskou/value-objects';

import { NetworkId } from '../value-objects/NetworkId';
import { NetworkName } from '../value-objects/NetworkName';

export class NetworkPeerNetwork {
  public static fromPrimitives(
    primitives: PrimitiveOf<NetworkPeerNetwork>,
  ): NetworkPeerNetwork {
    return new NetworkPeerNetwork(
      NetworkId.fromString(primitives.id),
      NetworkName.fromString(primitives.name),
    );
  }

  private constructor(
    private readonly id: NetworkId,
    private readonly name: NetworkName,
  ) {}

  public belongsTo(networkId: NetworkId): boolean {
    return this.id.isEqual(networkId);
  }

  public toPrimitives() {
    return {
      id: this.id.toString(),
      name: this.name.toString(),
    };
  }
}
