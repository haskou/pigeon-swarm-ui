import type { NodeRelayConfiguration } from './NodeRelayConfiguration';

export function defaultNodeRelayConfiguration(): NodeRelayConfiguration {
  return {
    callsRelay: {},
    manualRelayMultiaddrs: [],
    privateRelay: {
      discoveryEnabled: true,
      enabled: false,
      publicationEnabled: false,
    },
    publicNetwork: {
      enabled: false,
    },
  };
}
