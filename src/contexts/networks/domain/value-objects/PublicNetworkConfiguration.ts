import type { PrimitiveOf } from '@haskou/value-objects';

import { NodeCapabilityStatus } from './NodeCapabilityStatus';
import { NodeRelayPort } from './NodeRelayPort';

export class PublicNetworkConfiguration {
  public static fromPrimitives(
    primitives: PrimitiveOf<PublicNetworkConfiguration>,
  ): PublicNetworkConfiguration {
    return new PublicNetworkConfiguration(
      NodeCapabilityStatus.fromBoolean(primitives.enabled),
      NodeRelayPort.fromOptional(primitives.port),
    );
  }

  public constructor(
    private readonly enabled: NodeCapabilityStatus,
    private readonly port: NodeRelayPort,
  ) {}

  public toPrimitives() {
    return {
      enabled: this.enabled.isEnabled(),
      port: this.port.isConfigured() ? this.port.valueOf() : undefined,
    };
  }
}
