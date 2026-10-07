import type { Timestamp } from '@haskou/value-objects';

import type { Call } from '../Call';
import type { CallMediaConnection } from '../entities/CallMediaConnection';
import type { CallId } from '../value-objects/CallId';
import type { CallIdentityId } from '../value-objects/CallIdentityId';
import type { CallScope } from '../value-objects/CallScope';

export interface CallRepository {
  create(
    scope: CallScope,
    actorIdentityId: CallIdentityId,
    startedAt: Timestamp,
  ): Promise<Call>;
  end(
    call: Call,
    actorIdentityId: CallIdentityId,
    endedAt: Timestamp,
  ): Promise<void>;
  find(callId: CallId, actorIdentityId: CallIdentityId): Promise<Call>;
  heartbeat(
    callId: CallId,
    actorIdentityId: CallIdentityId,
    mediaConnections: CallMediaConnection[],
  ): Promise<void>;
  join(
    call: Call,
    actorIdentityId: CallIdentityId,
    joinedAt: Timestamp,
  ): Promise<Call>;
  leave(
    call: Call,
    actorIdentityId: CallIdentityId,
    leftAt: Timestamp,
    declined: boolean,
  ): Promise<void>;
  search(actorIdentityId: CallIdentityId): Promise<Call[]>;
}
