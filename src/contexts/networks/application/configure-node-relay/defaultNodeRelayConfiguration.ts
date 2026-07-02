import type { NodeRelayConfiguration } from './NodeRelayConfiguration';

export function defaultNodeRelayConfiguration(): NodeRelayConfiguration {
  return {
    callsRelay: {},
    manualRelayMultiaddrs: [],
    privateRelay: {
      enabled: false,
      publicRecordDiscoveryEnabled: false,
      publicRecordPublicationEnabled: false,
    },
    publicRelay: {
      autoEnabled: false,
      discoveryEnabled: false,
      enabled: false,
    },
  };
}
