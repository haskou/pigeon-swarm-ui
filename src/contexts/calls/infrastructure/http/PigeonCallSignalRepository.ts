import type { CallSignalRepository } from '../../domain/repositories/CallSignalRepository';
import type { CallId } from '../../domain/value-objects/CallId';
import type { CallIdentityId } from '../../domain/value-objects/CallIdentityId';
import type { CallSignal } from '../../domain/value-objects/CallSignal';

import { CallSignalDelivery } from '../../domain/entities/CallSignalDelivery';
import { CallAccessContexts } from './CallAccessContexts';
import { PigeonCallsApi } from './PigeonCallsApi';

export class PigeonCallSignalRepository implements CallSignalRepository {
  public constructor(
    private readonly api: PigeonCallsApi,
    private readonly contexts: CallAccessContexts,
  ) {}

  public async create(
    callId: CallId,
    actorIdentityId: CallIdentityId,
    signal: CallSignal,
  ): Promise<CallSignalDelivery> {
    const resource = await this.api.sendSignal(
      this.contexts.find(actorIdentityId),
      callId.toString(),
      signal.toPrimitives(),
    );

    return CallSignalDelivery.fromPrimitives(resource);
  }
}
