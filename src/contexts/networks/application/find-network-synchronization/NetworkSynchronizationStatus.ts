import type { NetworkSynchronizationNetwork } from './NetworkSynchronizationNetwork';

export type NetworkSynchronizationStatus = {
  changedAt: number;
  networks: NetworkSynchronizationNetwork[];
};
