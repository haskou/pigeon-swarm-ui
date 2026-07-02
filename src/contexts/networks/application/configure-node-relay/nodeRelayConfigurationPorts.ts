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

function publicRelayTargets(
  configuration: NodeRelayConfiguration,
): NodeRelayPortCheckTarget[] {
  if (!configuration.publicRelay.enabled) return [];

  return [
    optionalTarget(
      'publicRelay',
      'Public relay',
      configuration.publicRelay.port,
    ),
    optionalTarget(
      'publicRelayLibp2p',
      'Public relay libp2p',
      configuration.publicRelay.libp2pPort,
    ),
  ].filter((target): target is NodeRelayPortCheckTarget => target !== null);
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

export function nodeRelayConfigurationPorts(
  configuration: NodeRelayConfiguration,
): NodeRelayPortCheckTarget[] {
  return [
    ...callsRelayTargets(configuration),
    ...publicRelayTargets(configuration),
    ...privateRelayTargets(configuration),
  ];
}
