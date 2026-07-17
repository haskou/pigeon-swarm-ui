import type { PrimitiveOf } from '@haskou/value-objects';

import { CallIdentityId } from './CallIdentityId';
import { CallSignalContent } from './CallSignalContent';
import { CallSignalType } from './CallSignalType';

export class CallSignal {
  public static fromPrimitives(
    primitives: PrimitiveOf<CallSignal>,
  ): CallSignal {
    return new CallSignal(
      CallIdentityId.fromString(primitives.recipientIdentityId),
      CallSignalType.fromPrimitives(primitives.signalType),
      CallSignalContent.fromPrimitives(primitives.payload),
    );
  }

  public constructor(
    private readonly recipientIdentityId: CallIdentityId,
    private readonly type: CallSignalType,
    private readonly content: CallSignalContent,
  ) {}

  public toPrimitives() {
    return {
      payload: this.content.valueOf(),
      recipientIdentityId: this.recipientIdentityId.toString(),
      signalType: this.type.valueOf(),
    };
  }
}
