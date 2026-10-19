import type { NodeNetwork } from './NodeNetwork';

const publicNetworkNames: Record<string, true> = {
  public: true,
  'public network': true,
};

export function isPublicNodeNetwork(network: NodeNetwork): boolean {
  return publicNetworkNames[network.name.trim().toLowerCase()] === true;
}

/**
 * Network ids a direct conversation or a private community may use. The node
 * refuses both on the public network, so `privateOnly` drops it; callers must
 * not fall back to it. A network the node list does not describe is kept, as
 * nothing marks it as public, and the node still enforces the rule. Public
 * communities keep every network.
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

  const publicIds = new Set(
    nodeNetworks.filter(isPublicNodeNetwork).map((network) => network.id),
  );

  return networkIds.filter((networkId) => !publicIds.has(networkId));
}
