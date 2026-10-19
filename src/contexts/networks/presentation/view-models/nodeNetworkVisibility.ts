import type { NodeNetwork } from './NodeNetwork';

const publicNetworkNames: Record<string, true> = {
  public: true,
  'public network': true,
};

export function isPublicNodeNetwork(network: NodeNetwork): boolean {
  return publicNetworkNames[network.name.trim().toLowerCase()] === true;
}

/**
 * Network ids a direct conversation or a private community may use. Private
 * placement needs a positive match: the id must be in the node list and must
 * not be identified as the public network. An empty or not-yet-loaded node
 * list therefore places nothing, and callers must never fall back to the
 * public network. Public communities keep every identity network.
 */
export function allowedNetworkIds({
  networkIds,
  nodeNetworks,
  privateOnly,
}: {
  networkIds: string[];
  nodeNetworks: NodeNetwork[];
  privateOnly: boolean;
}): string[] {
  if (!privateOnly) return networkIds;

  const privateIds = new Set(
    nodeNetworks
      .filter((network) => !isPublicNodeNetwork(network))
      .map((network) => network.id),
  );

  return networkIds.filter((networkId) => privateIds.has(networkId));
}
