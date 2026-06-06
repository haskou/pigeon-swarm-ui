import type { PeerNetwork } from './PeerNetwork';

export type Peer = {
  id: string;
  lastSeenAt: number;
  networks: PeerNetwork[];
  owner?: string;
};
