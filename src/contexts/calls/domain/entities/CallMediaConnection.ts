import type { PrimitiveOf } from '@haskou/value-objects';

import { CallConnectionState } from '../value-objects/CallConnectionState';
import { CallIdentityId } from '../value-objects/CallIdentityId';
import { CallMediaRoute } from '../value-objects/CallMediaRoute';
import { CallRelayUsage } from '../value-objects/CallRelayUsage';

export class CallMediaConnection {
  public static fromPrimitives(
    primitives: PrimitiveOf<CallMediaConnection>,
  ): CallMediaConnection {
    return new CallMediaConnection(
      CallIdentityId.fromString(primitives.remoteIdentityId),
      CallConnectionState.fromPrimitives(primitives.state),
      primitives.usesRelay ? CallRelayUsage.RELAY : CallRelayUsage.DIRECT,
      CallMediaRoute.fromPrimitives(primitives),
    );
  }

  private constructor(
    private readonly remoteIdentityId: CallIdentityId,
    private readonly state: CallConnectionState,
    private readonly relayUsage: CallRelayUsage,
    private readonly route: CallMediaRoute,
  ) {}

  public toPrimitives() {
    const primitives = {
      ...this.route.toPrimitives(),
      remoteIdentityId: this.remoteIdentityId.toString(),
      state: this.state.valueOf(),
      usesRelay: this.relayUsage.usesRelay(),
    };

    return primitives;
  }
}
