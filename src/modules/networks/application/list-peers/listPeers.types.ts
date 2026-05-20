export type PeerNetwork = {
  id: string;
  name: string;
};

export type Peer = {
  id: string;
  lastSeenAt: number;
  networks: PeerNetwork[];
  owner?: string;
};
