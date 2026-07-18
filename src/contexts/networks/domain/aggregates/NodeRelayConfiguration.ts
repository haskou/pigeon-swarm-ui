import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { AggregateRoot } from '../../../../shared/domain/AggregateRoot';
import { NodeRelayConfigurationUpdated } from '../events/NodeRelayConfigurationUpdated';
import { CallsRelayConfiguration } from '../value-objects/CallsRelayConfiguration';
import { NetworkNodeId } from '../value-objects/NetworkNodeId';
import { NodePublicHost } from '../value-objects/NodePublicHost';
import { NodeRelayMultiaddress } from '../value-objects/NodeRelayMultiaddress';
import { PrivateRelayConfiguration } from '../value-objects/PrivateRelayConfiguration';
import { PublicNetworkConfiguration } from '../value-objects/PublicNetworkConfiguration';

export class NodeRelayConfiguration extends AggregateRoot {
  public static fromPrimitives(
    primitives: PrimitiveOf<NodeRelayConfiguration>,
  ): NodeRelayConfiguration {
    return new NodeRelayConfiguration(
      NetworkNodeId.fromString(primitives.nodeId),
      CallsRelayConfiguration.fromPrimitives(primitives.callsRelay),
      primitives.manualRelayMultiaddrs.map((address) =>
        NodeRelayMultiaddress.fromString(address),
      ),
      PrivateRelayConfiguration.fromPrimitives(primitives.privateRelay),
      NodePublicHost.fromOptional(primitives.publicHost),
      PublicNetworkConfiguration.fromPrimitives(primitives.publicNetwork),
    );
  }

  private constructor(
    private readonly nodeId: NetworkNodeId,
    private callsRelay: CallsRelayConfiguration,
    private manualRelayMultiaddrs: NodeRelayMultiaddress[],
    private privateRelay: PrivateRelayConfiguration,
    private publicHost: NodePublicHost,
    private publicNetwork: PublicNetworkConfiguration,
  ) {
    super();
  }

  public configure(
    callsRelay: CallsRelayConfiguration,
    manualRelayMultiaddrs: NodeRelayMultiaddress[],
    privateRelay: PrivateRelayConfiguration,
    publicHost: NodePublicHost,
    publicNetwork: PublicNetworkConfiguration,
    occurredAt: Timestamp,
  ): void {
    this.callsRelay = callsRelay;
    this.manualRelayMultiaddrs = [...manualRelayMultiaddrs];
    this.privateRelay = privateRelay;
    this.publicHost = publicHost;
    this.publicNetwork = publicNetwork;
    this.record(new NodeRelayConfigurationUpdated(this.nodeId, occurredAt));
  }

  public toPrimitives() {
    return {
      callsRelay: this.callsRelay.toPrimitives(),
      manualRelayMultiaddrs: this.manualRelayMultiaddrs.map((address) =>
        address.toString(),
      ),
      nodeId: this.nodeId.toString(),
      privateRelay: this.privateRelay.toPrimitives(),
      publicHost: this.publicHost.isConfigured()
        ? this.publicHost.toString()
        : undefined,
      publicNetwork: this.publicNetwork.toPrimitives(),
    };
  }
}
