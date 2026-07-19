import { NullObject } from '@haskou/value-objects';

import { NetworkId } from '../value-objects/NetworkId';

export class SharedNetworkSelectorDomainService {
  private includes(networks: NetworkId[], candidate: NetworkId): boolean {
    return networks.some((network) => network.isEqual(candidate));
  }

  public select(
    ownNetworks: NetworkId[],
    peerNetworks: NetworkId[],
    preferredNetwork: NetworkId,
  ): NetworkId {
    if (
      preferredNetwork.isAvailable() &&
      this.includes(ownNetworks, preferredNetwork) &&
      (peerNetworks.length === 0 ||
        this.includes(peerNetworks, preferredNetwork))
    ) {
      return preferredNetwork;
    }

    return (
      peerNetworks.find((network) => this.includes(ownNetworks, network)) ??
      NullObject.new(NetworkId)
    );
  }
}
