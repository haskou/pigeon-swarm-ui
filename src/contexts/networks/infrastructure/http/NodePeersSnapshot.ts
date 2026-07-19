import type { NetworkPeerResource } from './resources/NetworkPeerResource';
import type { NetworkSynchronizationResource } from './resources/NetworkSynchronizationResource';

export type NodePeersSnapshot = {
  ipfsPeers: Array<{
    id: string;
    networks: Array<{
      id: string;
      name: string;
      type: string;
    }>;
  }>;
  networkSynchronization: NetworkSynchronizationResource | null;
  peers: NetworkPeerResource[];
};
