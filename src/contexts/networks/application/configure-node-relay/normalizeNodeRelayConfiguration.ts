import type { NodeRelayConfiguration } from './NodeRelayConfiguration';

import { defaultNodeRelayConfiguration } from './defaultNodeRelayConfiguration';

export function normalizeNodeRelayConfiguration(
  configuration: Partial<NodeRelayConfiguration> | null | undefined,
): NodeRelayConfiguration {
  const defaults = defaultNodeRelayConfiguration();

  return {
    callsRelay: {
      ...defaults.callsRelay,
      ...(configuration?.callsRelay ?? {}),
    },
    manualRelayMultiaddrs: configuration?.manualRelayMultiaddrs ?? [],
    privateRelay: {
      ...defaults.privateRelay,
      ...(configuration?.privateRelay ?? {}),
    },
    publicHost: configuration?.publicHost,
    publicRelay: {
      ...defaults.publicRelay,
      ...(configuration?.publicRelay ?? {}),
    },
  };
}
