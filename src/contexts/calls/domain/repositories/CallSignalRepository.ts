import type { CallSignalDelivery } from '../entities/CallSignalDelivery';
import type { CallId } from '../value-objects/CallId';
import type { CallIdentityId } from '../value-objects/CallIdentityId';
import type { CallSignal } from '../value-objects/CallSignal';

export interface CallSignalRepository {
  create(
    callId: CallId,
    actorIdentityId: CallIdentityId,
    signal: CallSignal,
  ): Promise<CallSignalDelivery>;
}
