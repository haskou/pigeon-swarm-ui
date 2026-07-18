import type { NetworkSynchronizationStatus } from '../../application/find-network-synchronization/NetworkSynchronizationStatus';
import type { NetworkPeerResource } from './resources/NetworkPeerResource';

export type NodePeersSnapshot = {
  ipfsPeers: Array<{
    id: string;
    networks: Array<{
      id: string;
      name: string;
      type: string;
    }>;
  }>;
  networkSynchronization: NetworkSynchronizationStatus | null;
  peers: NetworkPeerResource[];
};
