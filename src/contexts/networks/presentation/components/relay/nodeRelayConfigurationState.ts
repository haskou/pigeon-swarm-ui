import type { NodeRelayConfigurationViewModel } from '../../view-models/NodeRelayConfigurationViewModel';

export function hasRemoteAccessConfiguration(
  configuration: NodeRelayConfigurationViewModel,
): boolean {
  return Boolean(
    configuration.publicHost?.trim() ||
    configuration.callsRelay.port ||
    configuration.publicNetwork.enabled ||
    configuration.privateRelay.enabled,
  );
}

export function needsPublicHost(
  configuration: NodeRelayConfigurationViewModel,
): boolean {
  if (configuration.publicHost?.trim()) return false;

  return (
    configuration.privateRelay.enabled ||
    configuration.callsRelay.port !== undefined ||
    configuration.publicNetwork.enabled ||
    configuration.publicNetwork.port !== undefined
  );
}
