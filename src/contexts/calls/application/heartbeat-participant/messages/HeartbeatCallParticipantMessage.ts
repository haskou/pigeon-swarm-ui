import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { CallMediaConnection } from '../../../domain/entities/CallMediaConnection';
import { CallId } from '../../../domain/value-objects/CallId';
import { CallIdentityId } from '../../../domain/value-objects/CallIdentityId';

export class HeartbeatCallParticipantMessage {
  public constructor(
    private readonly primitives: {
      actorIdentityId: string;
      callId: string;
      mediaConnections: PrimitiveOf<CallMediaConnection>[];
      occurredAt: number;
    },
  ) {}

  public getActorIdentityId(): CallIdentityId {
    return CallIdentityId.fromString(this.primitives.actorIdentityId);
  }

  public getCallId(): CallId {
    return CallId.fromString(this.primitives.callId);
  }

  public getMediaConnections(): CallMediaConnection[] {
    return this.primitives.mediaConnections.map((connection) =>
      CallMediaConnection.fromPrimitives(connection),
    );
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.primitives.occurredAt);
  }
}
