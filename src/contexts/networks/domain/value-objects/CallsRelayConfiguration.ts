import type { PrimitiveOf } from '@haskou/value-objects';

import { NodeRelayPort } from './NodeRelayPort';

export class CallsRelayConfiguration {
  public static fromPrimitives(
    primitives: PrimitiveOf<CallsRelayConfiguration>,
  ): CallsRelayConfiguration {
    return new CallsRelayConfiguration(
      NodeRelayPort.fromOptional(primitives.port),
    );
  }

  public constructor(private readonly port: NodeRelayPort) {}

  public toPrimitives() {
    return {
      port: this.port.isConfigured() ? this.port.valueOf() : undefined,
    };
  }
}
