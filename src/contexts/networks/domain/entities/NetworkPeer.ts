import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import type { NetworkId } from '../value-objects/NetworkId';

import { NetworkNodeType } from '../value-objects/NetworkNodeType';
import { NetworkPeerId } from '../value-objects/NetworkPeerId';
import { NetworkPeerOwnerId } from '../value-objects/NetworkPeerOwnerId';
import { NetworkPeerCapabilities } from './NetworkPeerCapabilities';
import { NetworkPeerConnectionSummary } from './NetworkPeerConnectionSummary';
import { NetworkPeerNetwork } from './NetworkPeerNetwork';

export class NetworkPeer {
  public static fromPrimitives(
    primitives: PrimitiveOf<NetworkPeer>,
  ): NetworkPeer {
    return new NetworkPeer(
      NetworkPeerId.fromString(primitives.id),
      NetworkPeerOwnerId.fromOptional(primitives.owner),
      new Timestamp(primitives.lastSeenAt),
      NetworkNodeType.fromPrimitives(primitives.nodeType),
      NetworkPeerCapabilities.fromPrimitives(primitives.capabilities),
      NetworkPeerConnectionSummary.fromPrimitives(primitives.connectionSummary),
      primitives.networks.map(NetworkPeerNetwork.fromPrimitives),
    );
  }

  private constructor(
    private readonly id: NetworkPeerId,
    private readonly owner: NetworkPeerOwnerId | undefined,
    private readonly lastSeenAt: Timestamp,
    private readonly nodeType: NetworkNodeType,
    private readonly capabilities: NetworkPeerCapabilities,
    private readonly connectionSummary: NetworkPeerConnectionSummary,
    private readonly networks: NetworkPeerNetwork[],
  ) {}

  public belongsTo(peerId: NetworkPeerId): boolean {
    return this.id.isEqual(peerId);
  }

  public sharesNetwork(networkId: NetworkId): boolean {
    return this.networks.some((network) => network.belongsTo(networkId));
  }

  public toPrimitives() {
    return {
      capabilities: this.capabilities.toPrimitives(),
      connectionSummary: this.connectionSummary.toPrimitives(),
      id: this.id.toString(),
      lastSeenAt: this.lastSeenAt.valueOf(),
      networks: this.networks.map((network) => network.toPrimitives()),
      nodeType: this.nodeType.valueOf(),
      owner: this.owner?.toString(),
    };
  }
}
