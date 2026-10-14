import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { CallId } from './CallId';
import { CallStatus } from './CallStatus';

export class CallLifecycle {
  public static fromPrimitives(
    primitives: PrimitiveOf<CallLifecycle>,
  ): CallLifecycle {
    return new CallLifecycle(
      CallStatus.fromPrimitives(primitives.status),
      primitives.createdAt === undefined
        ? undefined
        : new Timestamp(primitives.createdAt),
      primitives.endedAt ? new Timestamp(primitives.endedAt) : undefined,
      primitives.supersededByCallId
        ? CallId.fromString(primitives.supersededByCallId)
        : undefined,
    );
  }

  private constructor(
    private readonly status: CallStatus,
    private readonly createdAt: Timestamp | undefined,
    private readonly endedAt?: Timestamp,
    private readonly supersededByCallId?: CallId,
  ) {}

  public end(at: Timestamp): CallLifecycle {
    return new CallLifecycle(CallStatus.ENDED, this.createdAt, at);
  }

  public isActive(): boolean {
    return this.status.isActive();
  }

  public isEnded(): boolean {
    return this.status.isEnded();
  }

  public toPrimitives() {
    const primitives: {
      createdAt?: number;
      endedAt?: number;
      status: ReturnType<CallStatus['valueOf']>;
      supersededByCallId?: string;
    } = {
      ...(this.createdAt ? { createdAt: this.createdAt.valueOf() } : {}),
      status: this.status.valueOf(),
    };

    if (this.endedAt) primitives.endedAt = this.endedAt.valueOf();

    if (this.supersededByCallId) {
      primitives.supersededByCallId = this.supersededByCallId.toString();
    }

    return primitives;
  }
}
