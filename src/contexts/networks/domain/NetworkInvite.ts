import type { PrimitiveOf } from '@haskou/value-objects';

import { NetworkId } from './value-objects/NetworkId';
import { NetworkKey } from './value-objects/NetworkKey';
import { NetworkName } from './value-objects/NetworkName';

export class NetworkInvite {
  public static fromPrimitives(
    primitives: PrimitiveOf<NetworkInvite>,
  ): NetworkInvite {
    return new NetworkInvite(
      NetworkId.fromString(primitives.id),
      NetworkKey.fromString(primitives.key),
      NetworkName.fromString(primitives.name),
    );
  }

  private constructor(
    private readonly id: NetworkId,
    private readonly key: NetworkKey,
    private readonly name: NetworkName,
  ) {}

  public toPrimitives() {
    return {
      id: this.id.toString(),
      key: this.key.toString(),
      name: this.name.toString(),
    };
  }
}
