import type { Session } from '../../../identities/infrastructure/session/Session';
import type { CallSignalRepository } from '../../domain/repositories/CallSignalRepository';
import type { CallId } from '../../domain/value-objects/CallId';
import type { CallIdentityId } from '../../domain/value-objects/CallIdentityId';
import type { CallSignal } from '../../domain/value-objects/CallSignal';
import type { CallSignalSealInput } from '../signals/CallSignalSealer';
import type { SealedCallSignal } from '../signals/SealedCallSignal';

import { CallSignalDelivery } from '../../domain/entities/CallSignalDelivery';
import { CallAccessContexts } from './CallAccessContexts';
import { PigeonCallsApi } from './PigeonCallsApi';

type SignalSealer = {
  seal(session: Session, input: CallSignalSealInput): Promise<SealedCallSignal>;
};

type CallBinding = Pick<CallSignalSealInput, 'networkId' | 'scopeType'>;

export class PigeonCallSignalRepository implements CallSignalRepository {
  private readonly bindings = new Map<string, Promise<CallBinding>>();

  public constructor(
    private readonly api: PigeonCallsApi,
    private readonly contexts: CallAccessContexts,
    private readonly sealer: SignalSealer,
  ) {}

  /** The network and scope a signal of this call is bound to, read once. */
  private binding(session: Session, callId: string): Promise<CallBinding> {
    const cacheKey = `${session.identity.id}|${callId}`;
    const cached = this.bindings.get(cacheKey);

    if (cached) return cached;

    const read = this.api.get(session, callId).then((call) => ({
      networkId: call.networkId,
      scopeType: call.scope.type as CallSignalSealInput['scopeType'],
    }));

    read.catch(() => this.bindings.delete(cacheKey));
    this.bindings.set(cacheKey, read);

    return read;
  }

  public async create(
    callId: CallId,
    actorIdentityId: CallIdentityId,
    signal: CallSignal,
  ): Promise<CallSignalDelivery> {
    const session = this.contexts.find(actorIdentityId);
    const { payload, recipientIdentityId, signalType } = signal.toPrimitives();
    const sealed = await this.sealer.seal(session, {
      callId: callId.toString(),
      ...(await this.binding(session, callId.toString())),
      payload,
      recipientIdentityId,
      signalType,
    });
    const resource = await this.api.sendSignal(
      session,
      callId.toString(),
      sealed,
    );

    return CallSignalDelivery.fromPrimitives(resource);
  }
}
