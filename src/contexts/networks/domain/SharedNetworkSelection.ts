export class SharedNetworkSelection {
  public static select(
    ownNetworkIds: string[],
    peerNetworkIds: string[] | undefined,
    preferredNetworkId?: string,
  ): string | undefined {
    const peerNetworks = peerNetworkIds ?? [];

    if (
      preferredNetworkId &&
      ownNetworkIds.includes(preferredNetworkId) &&
      (peerNetworks.length === 0 || peerNetworks.includes(preferredNetworkId))
    ) {
      return preferredNetworkId;
    }

    return peerNetworks.find((networkId) => ownNetworkIds.includes(networkId));
  }
}
