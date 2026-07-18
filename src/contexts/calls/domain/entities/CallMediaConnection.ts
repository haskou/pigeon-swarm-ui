import type { PrimitiveOf } from '@haskou/value-objects';

import { CallConnectionRoute } from '../value-objects/CallConnectionRoute';
import { CallConnectionState } from '../value-objects/CallConnectionState';
import { CallIdentityId } from '../value-objects/CallIdentityId';

export class CallMediaConnection {
  public static fromPrimitives(
    primitives: PrimitiveOf<CallMediaConnection>,
  ): CallMediaConnection {
    return new CallMediaConnection(
      CallIdentityId.fromString(primitives.remoteIdentityId),
      CallConnectionState.fromPrimitives(primitives.state),
      CallConnectionRoute.fromPrimitives(primitives),
    );
  }

  private constructor(
    private readonly remoteIdentityId: CallIdentityId,
    private readonly state: CallConnectionState,
    private readonly route: CallConnectionRoute,
  ) {}

  public toPrimitives() {
    return {
      remoteIdentityId: this.remoteIdentityId.toString(),
      state: this.state.valueOf(),
      ...this.route.toPrimitives(),
    };
  }
}
