import type { PeerNetwork } from './PeerNetwork';

export type Peer = {
  capabilities: {
    gossipsub: boolean;
    privateIpfs: boolean;
    publicIpfs: boolean;
    relay: boolean;
  };
  connectionSummary: {
    isSharedNetworkPeer: boolean;
    sharedNetworkCount: number;
  };
  id: string;
  lastSeenAt: number;
  networks: PeerNetwork[];
  nodeType: 'leaf' | 'reachable' | 'relay' | 'unknown';
  owner?: string;
};
