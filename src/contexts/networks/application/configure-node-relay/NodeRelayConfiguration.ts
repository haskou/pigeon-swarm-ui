export type NodeRelayConfiguration = {
  callsRelay: {
    port?: number;
  };
  manualRelayMultiaddrs: string[];
  privateRelay: {
    enabled: boolean;
    portEnd?: number;
    portStart?: number;
    publicRecordDiscoveryEnabled: boolean;
    publicRecordPublicationEnabled: boolean;
  };
  publicHost?: string;
  publicRelay: {
    autoEnabled: boolean;
    discoveryEnabled: boolean;
    enabled: boolean;
    libp2pPort?: number;
    port?: number;
  };
};
