import type { Peer } from '../list-peers/listPeers.types';

export interface ListPeersPort {
  getPeers(): Promise<Peer[]>;
}
