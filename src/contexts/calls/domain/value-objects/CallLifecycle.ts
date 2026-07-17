import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { CallStatus } from './CallStatus';

export class CallLifecycle {
  public static fromPrimitives(
    primitives: PrimitiveOf<CallLifecycle>,
  ): CallLifecycle {
    return new CallLifecycle(
      CallStatus.fromPrimitives(primitives.status),
      new Timestamp(primitives.createdAt),
      primitives.endedAt ? new Timestamp(primitives.endedAt) : undefined,
    );
  }

  private constructor(
    private readonly status: CallStatus,
    private readonly createdAt: Timestamp,
    private readonly endedAt?: Timestamp,
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
      createdAt: number;
      endedAt?: number;
      status: ReturnType<CallStatus['valueOf']>;
    } = {
      createdAt: this.createdAt.valueOf(),
      status: this.status.valueOf(),
    };

    if (this.endedAt) primitives.endedAt = this.endedAt.valueOf();

    return primitives;
  }
}
