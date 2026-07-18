export interface NodeRelayConfigurationViewModel {
  callsRelay: {
    port?: number;
  };
  manualRelayMultiaddrs: string[];
  privateRelay: {
    discoveryEnabled: boolean;
    enabled: boolean;
    publicationEnabled: boolean;
    portEnd?: number;
    portStart?: number;
  };
  publicHost?: string;
  publicNetwork: {
    enabled: boolean;
    port?: number;
  };
}
