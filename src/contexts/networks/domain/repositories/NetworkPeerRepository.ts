import type { NetworkPeer } from '../entities/NetworkPeer';

export interface NetworkPeerRepository {
  search(): Promise<NetworkPeer[]>;
}
