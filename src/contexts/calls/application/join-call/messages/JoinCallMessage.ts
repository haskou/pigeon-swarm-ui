import { Timestamp } from '@haskou/value-objects';

import { CallId } from '../../../domain/value-objects/CallId';
import { CallIdentityId } from '../../../domain/value-objects/CallIdentityId';

export class JoinCallMessage {
  public constructor(
    private readonly callId: string,
    private readonly actorIdentityId: string,
    private readonly occurredAt: number,
  ) {}

  public getActorIdentityId(): CallIdentityId {
    return CallIdentityId.fromString(this.actorIdentityId);
  }

  public getCallId(): CallId {
    return CallId.fromString(this.callId);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }
}
