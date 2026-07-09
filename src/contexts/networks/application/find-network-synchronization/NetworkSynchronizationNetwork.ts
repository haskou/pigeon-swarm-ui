import type { NetworkSynchronizationState } from './NetworkSynchronizationState';
import type { NetworkSynchronizationStore } from './NetworkSynchronizationStore';

export type NetworkSynchronizationNetwork = {
  connectedPeerIds: string[];
  convergedStoreCount: number;
  id: string;
  name: string;
  replicationPeerIds: string[];
  state: NetworkSynchronizationState;
  stores: NetworkSynchronizationStore[];
  totalStoreCount: number;
  type: 'private' | 'public';
};
