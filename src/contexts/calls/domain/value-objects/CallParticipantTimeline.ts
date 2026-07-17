import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

export class CallParticipantTimeline {
  public static fromPrimitives(
    primitives: PrimitiveOf<CallParticipantTimeline>,
  ): CallParticipantTimeline {
    const timestamp = (value?: number): Timestamp | undefined =>
      value ? new Timestamp(value) : undefined;

    return new CallParticipantTimeline(
      timestamp(primitives.joinedAt),
      timestamp(primitives.leftAt),
      timestamp(primitives.missedAt),
      timestamp(primitives.declinedAt),
      timestamp(primitives.lastHeartbeatAt),
    );
  }

  private constructor(
    private readonly joinedAt?: Timestamp,
    private readonly leftAt?: Timestamp,
    private readonly missedAt?: Timestamp,
    private readonly declinedAt?: Timestamp,
    private readonly lastHeartbeatAt?: Timestamp,
  ) {}

  public heartbeat(at: Timestamp): CallParticipantTimeline {
    return new CallParticipantTimeline(
      this.joinedAt,
      this.leftAt,
      this.missedAt,
      this.declinedAt,
      at,
    );
  }

  public join(at: Timestamp): CallParticipantTimeline {
    return new CallParticipantTimeline(
      at,
      this.leftAt,
      this.missedAt,
      this.declinedAt,
      this.lastHeartbeatAt,
    );
  }

  public leave(at: Timestamp): CallParticipantTimeline {
    return new CallParticipantTimeline(
      this.joinedAt,
      at,
      this.missedAt,
      this.declinedAt,
      this.lastHeartbeatAt,
    );
  }

  public markMissed(at: Timestamp): CallParticipantTimeline {
    return new CallParticipantTimeline(
      this.joinedAt,
      this.leftAt,
      at,
      this.declinedAt,
      this.lastHeartbeatAt,
    );
  }

  public toPrimitives() {
    const primitives: {
      declinedAt?: number;
      joinedAt?: number;
      lastHeartbeatAt?: number;
      leftAt?: number;
      missedAt?: number;
    } = {};

    if (this.declinedAt) primitives.declinedAt = this.declinedAt.valueOf();

    if (this.joinedAt) primitives.joinedAt = this.joinedAt.valueOf();

    if (this.lastHeartbeatAt) {
      primitives.lastHeartbeatAt = this.lastHeartbeatAt.valueOf();
    }

    if (this.leftAt) primitives.leftAt = this.leftAt.valueOf();

    if (this.missedAt) primitives.missedAt = this.missedAt.valueOf();

    return primitives;
  }
}
