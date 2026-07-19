export interface NetworkPeerResource {
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
  networks: Array<{
    id: string;
    name: string;
  }>;
  nodeType: 'leaf' | 'reachable' | 'relay' | 'unknown';
  owner?: string;
}
