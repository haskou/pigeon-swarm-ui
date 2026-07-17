import type { Call } from '../Call';
import type { CallMediaConnection } from '../entities/CallMediaConnection';
import type { CallId } from '../value-objects/CallId';
import type { CallIdentityId } from '../value-objects/CallIdentityId';
import type { CallScope } from '../value-objects/CallScope';

export interface CallRepository {
  create(scope: CallScope, actorIdentityId: CallIdentityId): Promise<Call>;
  end(call: Call, actorIdentityId: CallIdentityId): Promise<void>;
  find(callId: CallId, actorIdentityId: CallIdentityId): Promise<Call>;
  heartbeat(
    call: Call,
    actorIdentityId: CallIdentityId,
    mediaConnections: CallMediaConnection[],
  ): Promise<Call>;
  join(call: Call, actorIdentityId: CallIdentityId): Promise<Call>;
  leave(call: Call, actorIdentityId: CallIdentityId): Promise<void>;
  search(actorIdentityId: CallIdentityId): Promise<Call[]>;
}
