import type { Peer } from './Peer';

export interface ListPeersPort {
  getPeers(): Promise<Peer[]>;
}
