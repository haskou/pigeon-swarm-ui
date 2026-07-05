import type { NodeRelayConfiguration } from './NodeRelayConfiguration';

import { defaultNodeRelayConfiguration } from './defaultNodeRelayConfiguration';

function normalizeCallsRelay(
  configuration: Partial<NodeRelayConfiguration> | null | undefined,
  defaults: NodeRelayConfiguration,
): NodeRelayConfiguration['callsRelay'] {
  return {
    ...defaults.callsRelay,
    ...(configuration?.callsRelay ?? {}),
  };
}

function normalizePrivateRelay(
  privateRelay:
    | (Partial<NodeRelayConfiguration['privateRelay']> & {
        publicRecordDiscoveryEnabled?: boolean;
        publicRecordPublicationEnabled?: boolean;
      })
    | undefined,
  defaults: NodeRelayConfiguration,
): NodeRelayConfiguration['privateRelay'] {
  const enabled = privateRelay?.enabled ?? defaults.privateRelay.enabled;

  return {
    ...defaults.privateRelay,
    ...(privateRelay ?? {}),
    discoveryEnabled:
      privateRelay?.discoveryEnabled ??
      privateRelay?.publicRecordDiscoveryEnabled ??
      defaults.privateRelay.discoveryEnabled,
    enabled,
    publicationEnabled: enabled,
  };
}

function normalizePublicNetwork(
  configuration: Partial<NodeRelayConfiguration> | null | undefined,
  defaults: NodeRelayConfiguration,
): NodeRelayConfiguration['publicNetwork'] {
  return {
    ...defaults.publicNetwork,
    ...(configuration?.publicNetwork ?? {}),
  };
}

export function normalizeNodeRelayConfiguration(
  configuration:
    | (Partial<NodeRelayConfiguration> & {
        privateRelay?: Partial<NodeRelayConfiguration['privateRelay']> & {
          publicRecordDiscoveryEnabled?: boolean;
          publicRecordPublicationEnabled?: boolean;
        };
      })
    | null
    | undefined,
): NodeRelayConfiguration {
  const defaults = defaultNodeRelayConfiguration();

  return {
    callsRelay: normalizeCallsRelay(configuration, defaults),
    manualRelayMultiaddrs: configuration?.manualRelayMultiaddrs ?? [],
    privateRelay: normalizePrivateRelay(configuration?.privateRelay, defaults),
    publicHost: configuration?.publicHost ?? defaults.publicHost,
    publicNetwork: normalizePublicNetwork(configuration, defaults),
  };
}
