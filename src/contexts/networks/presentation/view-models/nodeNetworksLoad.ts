import type { NodeNetwork } from './NodeNetwork';

export type NodeNetworkListLoad = {
  failed: boolean;
  networks: NodeNetwork[];
};

/**
 * A failed network list is reported as failed, never as an empty list, so
 * callers can tell "no networks" from "could not load networks".
 */
export async function loadNodeNetworkList(
  load: () => Promise<NodeNetwork[]>,
): Promise<NodeNetworkListLoad> {
  try {
    return { failed: false, networks: await load() };
  } catch {
    return { failed: true, networks: [] };
  }
}
