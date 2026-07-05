import type { NodeRelayConfiguration } from './NodeRelayConfiguration';
import type { NodeRelayPortCheckTarget } from './NodeRelayPortCheckTarget';

function callsRelayTargets(
  configuration: NodeRelayConfiguration,
): NodeRelayPortCheckTarget[] {
  if (configuration.callsRelay.port === undefined) return [];

  return [
    {
      id: 'callsRelayUdp',
      label: 'Calls relay',
      port: configuration.callsRelay.port,
      protocol: 'udp',
    },
    {
      id: 'callsRelayTcp',
      label: 'Calls relay',
      port: configuration.callsRelay.port,
      protocol: 'tcp',
    },
  ];
}

function optionalTarget(
  id: string,
  label: string,
  port: number | undefined,
): NodeRelayPortCheckTarget | null {
  if (port === undefined) return null;

  return {
    id,
    label,
    port,
    protocol: 'tcp',
  };
}

function privateRelayTargets(
  configuration: NodeRelayConfiguration,
): NodeRelayPortCheckTarget[] {
  if (!configuration.privateRelay.enabled) return [];

  return [
    optionalTarget(
      'privateRelayStart',
      'Private relay range start',
      configuration.privateRelay.portStart,
    ),
    optionalTarget(
      'privateRelayEnd',
      'Private relay range end',
      configuration.privateRelay.portEnd,
    ),
  ].filter((target): target is NodeRelayPortCheckTarget => target !== null);
}

function publicNetworkTargets(
  configuration: NodeRelayConfiguration,
): NodeRelayPortCheckTarget[] {
  return [
    optionalTarget(
      'publicNetwork',
      'Public network',
      configuration.publicNetwork.port,
    ),
  ].filter((target): target is NodeRelayPortCheckTarget => target !== null);
}

export function nodeRelayConfigurationPorts(
  configuration: NodeRelayConfiguration,
): NodeRelayPortCheckTarget[] {
  return [
    ...publicNetworkTargets(configuration),
    ...callsRelayTargets(configuration),
    ...privateRelayTargets(configuration),
  ];
}
