import type { PrimitiveOf } from '@haskou/value-objects';

export class NetworkPeerCapabilities {
  public static fromPrimitives(
    primitives: PrimitiveOf<NetworkPeerCapabilities>,
  ): NetworkPeerCapabilities {
    return new NetworkPeerCapabilities(
      primitives.gossipsub,
      primitives.privateIpfs,
      primitives.publicIpfs,
      primitives.relay,
    );
  }

  private constructor(
    private readonly gossipsub: boolean,
    private readonly privateIpfs: boolean,
    private readonly publicIpfs: boolean,
    private readonly relay: boolean,
  ) {}

  public canRelay(): boolean {
    return this.relay;
  }

  public toPrimitives() {
    return {
      gossipsub: this.gossipsub,
      privateIpfs: this.privateIpfs,
      publicIpfs: this.publicIpfs,
      relay: this.relay,
    };
  }
}
