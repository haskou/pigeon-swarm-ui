export type NodeInfo = {
  id: string;
  networkSummary?: {
    privateCount: number;
    publicCount: number;
    total: number;
  };
  nodeType?: 'leaf' | 'reachable' | 'relay' | 'unknown';
  owner?: null | string;
  relay?: {
    advertised: boolean;
    autoEnabled: boolean;
    enabled: boolean;
    peerId?: string;
    running: boolean;
  };
  runtime?: {
    logLevel?: string;
    transport: 'in-memory' | 'libp2p-gossipsub' | 'unknown';
  };
};
