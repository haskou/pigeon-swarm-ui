import type { NodeNetwork } from './NodeNetwork';

/**
 * A network is private only when the node list carries its key. The node
 * sends keys only to its owner and only for private networks, so a session
 * without the owner's key sees no private placement. Names are never used.
 */
export function isPrivateNodeNetwork(network: NodeNetwork): boolean {
  return typeof network.key === 'string' && network.key.length > 0;
}

/**
 * Network ids a direct conversation, group or private community may use.
 * Private placement needs a positive match: the id must be in the node list
 * and carry a key. An empty, not-loaded or anonymous node list therefore
 * places nothing, and callers must never fall back to a public network.
 * Public communities keep every identity network.
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
    nodeNetworks.filter(isPrivateNodeNetwork).map((network) => network.id),
  );

  return networkIds.filter((networkId) => privateIds.has(networkId));
}
