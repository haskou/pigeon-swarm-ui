import type { NodeNetwork } from './NodeNetwork';

/**
 * A network is private only when the node flags it so. The node sets the flag
 * on signed list requests. An absent flag means unknown, so the network is not
 * offered for private placement. Keys never classify a network.
 */
export function isPrivateNodeNetwork(network: NodeNetwork): boolean {
  return network.privateNetwork === true;
}

/**
 * A network the node flags public. Only labels use it; placement never does.
 */
export function isPublicNodeNetwork(network: NodeNetwork): boolean {
  return network.privateNetwork === false;
}

/**
 * Network ids a direct conversation, group or private community may use.
 * Private placement needs a positive match: the id must be in the node list
 * and carry the node's private flag. An empty, not-loaded or anonymous node
 * list therefore places nothing, and callers must never fall back to a public
 * network.
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

/**
 * The selection to keep: the current network while the node still allows it,
 * otherwise the first allowed network. Nothing is selected when none is allowed.
 */
export function selectNetworkId(current: string, allowedIds: string[]): string {
  if (allowedIds.includes(current)) return current;

  return allowedIds[0] ?? '';
}
