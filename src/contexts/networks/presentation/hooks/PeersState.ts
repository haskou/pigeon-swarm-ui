import type { NodePeersSnapshot } from '../../infrastructure/http/NodePeersSnapshot';
import type { Peer } from '../view-models/Peer';

export interface PeersState {
  error: Error | null;
  ipfsPeerCount: number;
  loading: boolean;
  networkSynchronizationStatus: NodePeersSnapshot['networkSynchronization'];
  peers: Peer[];
  reload: () => Promise<void>;
}
