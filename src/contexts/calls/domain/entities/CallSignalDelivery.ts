import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { CallSignalId } from '../value-objects/CallSignalId';

export class CallSignalDelivery {
  public static fromPrimitives(
    primitives: PrimitiveOf<CallSignalDelivery>,
  ): CallSignalDelivery {
    return new CallSignalDelivery(
      CallSignalId.fromString(primitives.signalId),
      new Timestamp(primitives.expiresAt),
    );
  }

  public constructor(
    private readonly id: CallSignalId,
    private readonly expiresAt: Timestamp,
  ) {}

  public toPrimitives() {
    return {
      expiresAt: this.expiresAt.valueOf(),
      signalId: this.id.toString(),
    };
  }
}
