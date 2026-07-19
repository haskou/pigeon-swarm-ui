import { CallsRelayConfiguration } from '../../../domain/value-objects/CallsRelayConfiguration';
import { NetworkActorId } from '../../../domain/value-objects/NetworkActorId';
import { NetworkNodeId } from '../../../domain/value-objects/NetworkNodeId';
import { NodePublicHost } from '../../../domain/value-objects/NodePublicHost';
import { NodeRelayMultiaddress } from '../../../domain/value-objects/NodeRelayMultiaddress';
import { PrivateRelayConfiguration } from '../../../domain/value-objects/PrivateRelayConfiguration';
import { PublicNetworkConfiguration } from '../../../domain/value-objects/PublicNetworkConfiguration';

export class UpdateNodeRelayConfigurationMessage {
  public constructor(
    private readonly input: {
      actorIdentityId?: string;
      nodeId: string;
      callsRelay: { port?: number };
      manualRelayMultiaddrs: string[];
      privateRelay: {
        discoveryEnabled: boolean;
        enabled: boolean;
        portEnd?: number;
        portStart?: number;
      };
      publicHost?: string;
      publicNetwork: { enabled: boolean; port?: number };
    },
  ) {}

  public getActorId(): NetworkActorId {
    return NetworkActorId.fromOptional(this.input.actorIdentityId);
  }

  public getNodeId(): NetworkNodeId {
    return NetworkNodeId.fromString(this.input.nodeId);
  }

  public getCallsRelay(): CallsRelayConfiguration {
    return CallsRelayConfiguration.fromPrimitives({
      port: this.input.callsRelay.port,
    });
  }

  public getManualRelayMultiaddresses(): NodeRelayMultiaddress[] {
    return this.input.manualRelayMultiaddrs
      .map((address) => address.trim())
      .filter(Boolean)
      .map((address) => NodeRelayMultiaddress.fromString(address));
  }

  public getPrivateRelay(): PrivateRelayConfiguration {
    return PrivateRelayConfiguration.fromPrimitives({
      ...this.input.privateRelay,
      portEnd: this.input.privateRelay.portEnd,
      portStart: this.input.privateRelay.portStart,
      publicationEnabled: this.input.privateRelay.enabled,
    });
  }

  public getPublicHost(): NodePublicHost {
    return NodePublicHost.fromOptional(this.input.publicHost);
  }

  public getPublicNetwork(): PublicNetworkConfiguration {
    return PublicNetworkConfiguration.fromPrimitives({
      ...this.input.publicNetwork,
      port: this.input.publicNetwork.port,
    });
  }
}
