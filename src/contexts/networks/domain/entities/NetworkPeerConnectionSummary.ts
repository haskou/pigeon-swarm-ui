import { Integer, type PrimitiveOf } from '@haskou/value-objects';

export class NetworkPeerConnectionSummary {
  public static fromPrimitives(
    primitives: PrimitiveOf<NetworkPeerConnectionSummary>,
  ): NetworkPeerConnectionSummary {
    return new NetworkPeerConnectionSummary(
      primitives.isSharedNetworkPeer,
      new Integer(primitives.sharedNetworkCount),
    );
  }

  private constructor(
    private readonly isSharedNetworkPeer: boolean,
    private readonly sharedNetworkCount: Integer,
  ) {}

  public sharesNetworks(): boolean {
    return this.isSharedNetworkPeer && !this.sharedNetworkCount.isZero();
  }

  public toPrimitives() {
    return {
      isSharedNetworkPeer: this.isSharedNetworkPeer,
      sharedNetworkCount: this.sharedNetworkCount.valueOf(),
    };
  }
}
