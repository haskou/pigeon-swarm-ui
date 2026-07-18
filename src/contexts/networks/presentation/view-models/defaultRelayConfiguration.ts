import type { NodeRelayConfigurationViewModel } from './NodeRelayConfigurationViewModel';

export function defaultRelayConfiguration(): NodeRelayConfigurationViewModel {
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
