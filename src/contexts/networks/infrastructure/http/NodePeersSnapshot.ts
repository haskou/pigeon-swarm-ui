import type { NetworkSynchronizationStatus } from '../../application/find-network-synchronization/NetworkSynchronizationStatus';
import type { Peer } from '../../application/list-peers/Peer';

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
  peers: Peer[];
};
