export interface NetworkSynchronizationStatus {
  changedAt: number;
  networks: Array<{
    connectedPeerIds: string[];
    convergedStoreCount: number;
    id: string;
    name: string;
    replicationPeerIds: string[];
    state: 'converged' | 'syncing' | 'waiting_for_peers';
    stores: Array<{
      name: string;
      peerIds: string[];
      state: 'converged' | 'syncing' | 'waiting_for_peers';
    }>;
    totalStoreCount: number;
    type: 'private' | 'public';
  }>;
}
