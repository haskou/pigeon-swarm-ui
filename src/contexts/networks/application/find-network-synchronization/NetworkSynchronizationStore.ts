import type { NetworkSynchronizationState } from './NetworkSynchronizationState';

export type NetworkSynchronizationStore = {
  name: string;
  peerIds: string[];
  state: NetworkSynchronizationState;
};
