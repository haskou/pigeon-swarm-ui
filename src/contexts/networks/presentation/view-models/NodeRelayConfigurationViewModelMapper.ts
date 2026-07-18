import type { NodeRelayConfiguration } from '../../domain/NodeRelayConfiguration';
import type { NodeRelayConfigurationViewModel } from './NodeRelayConfigurationViewModel';

export class NodeRelayConfigurationViewModelMapper {
  public fromAggregate(
    configuration: NodeRelayConfiguration,
  ): NodeRelayConfigurationViewModel {
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
