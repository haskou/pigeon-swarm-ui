import type { NodeRelayConfigurationResource } from '../resources/NodeRelayConfigurationResource';

import { NodeRelayConfiguration } from '../../../domain/NodeRelayConfiguration';

export class NodeRelayConfigurationMapper {
  public toAggregate(
    nodeId: string,
    resource: NodeRelayConfigurationResource,
  ): NodeRelayConfiguration {
    return NodeRelayConfiguration.fromPrimitives({
      callsRelay: { port: resource.callsRelay.port },
      manualRelayMultiaddrs: resource.manualRelayMultiaddrs,
      nodeId,
      privateRelay: {
        ...resource.privateRelay,
        portEnd: resource.privateRelay.portEnd,
        portStart: resource.privateRelay.portStart,
      },
      publicHost: resource.publicHost,
      publicNetwork: {
        ...resource.publicNetwork,
        port: resource.publicNetwork.port,
      },
    });
  }

  public toResource(
    configuration: NodeRelayConfiguration,
  ): NodeRelayConfigurationResource {
    const primitives = configuration.toPrimitives();

    return {
      callsRelay: primitives.callsRelay,
      manualRelayMultiaddrs: primitives.manualRelayMultiaddrs,
      privateRelay: primitives.privateRelay,
      publicHost: primitives.publicHost,
      publicNetwork: primitives.publicNetwork,
    };
  }
}
