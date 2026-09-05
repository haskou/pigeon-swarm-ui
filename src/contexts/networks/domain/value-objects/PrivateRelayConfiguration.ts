import { NullObject, assert, type PrimitiveOf } from '@haskou/value-objects';

import { NodeRelayPortRangeInvalidError } from '../errors/NodeRelayPortRangeInvalidError';
import { NodeRelayPortRequiredError } from '../errors/NodeRelayPortRequiredError';
import { NodeCapabilityStatus } from './NodeCapabilityStatus';
import { NodeRelayPort } from './NodeRelayPort';

export class PrivateRelayConfiguration {
  public static fromPrimitives(
    primitives: PrimitiveOf<PrivateRelayConfiguration>,
  ): PrivateRelayConfiguration {
    return new PrivateRelayConfiguration(
      NodeCapabilityStatus.fromBoolean(primitives.discoveryEnabled),
      NodeCapabilityStatus.fromBoolean(primitives.enabled),
      NodeCapabilityStatus.fromBoolean(primitives.publicationEnabled),
      NodeRelayPort.fromOptional(primitives.portStart),
      NodeRelayPort.fromOptional(primitives.portEnd),
    );
  }

  public constructor(
    private readonly discoveryEnabled: NodeCapabilityStatus,
    private readonly enabled: NodeCapabilityStatus,
    private readonly publicationEnabled: NodeCapabilityStatus,
    private readonly portStart: NodeRelayPort,
    private readonly portEnd: NodeRelayPort,
  ) {
    assert(
      !enabled.isEnabled() ||
        (!NullObject.isNullObject(portStart) &&
          !NullObject.isNullObject(portEnd)),
      new NodeRelayPortRequiredError(),
    );
    assert(
      NullObject.isNullObject(portStart) ||
        NullObject.isNullObject(portEnd) ||
        portEnd.isGreaterOrEqualThan(portStart),
      new NodeRelayPortRangeInvalidError(),
    );
  }

  public toPrimitives() {
    return {
      discoveryEnabled: this.discoveryEnabled.isEnabled(),
      enabled: this.enabled.isEnabled(),
      portEnd: !NullObject.isNullObject(this.portEnd)
        ? this.portEnd.valueOf()
        : undefined,
      portStart: !NullObject.isNullObject(this.portStart)
        ? this.portStart.valueOf()
        : undefined,
      publicationEnabled: this.publicationEnabled.isEnabled(),
    };
  }
}
