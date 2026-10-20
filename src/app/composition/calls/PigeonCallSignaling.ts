import type { CallSignalDeliveryResource } from '../../../contexts/calls/infrastructure/http/resources/CallSignalDeliveryResource';
import type { CallSignalPayload } from '../../../contexts/calls/infrastructure/media/CallSignalPayload';
import type { SealedCallSignal } from '../../../contexts/calls/infrastructure/signals/SealedCallSignal';
import type { Session } from '../../../contexts/identities/infrastructure/session/Session';

import { CallSignalSender } from '../../../contexts/calls/application/send-call-signal/CallSignalSender';
import { SendCallSignalMessage } from '../../../contexts/calls/application/send-call-signal/messages/SendCallSignalMessage';
import { CallSessionRegistrar } from './CallSessionRegistrar';

type SignalVerdict = {
  receive(
    session: Session,
    signal: SealedCallSignal,
  ): Promise<{ payload: Record<string, unknown> }>;
};

type SealingRecords = { publish(session: Session): Promise<void> };

export class PigeonCallSignaling {
  public constructor(
    private readonly sessions: CallSessionRegistrar,
    private readonly sender: CallSignalSender,
    private readonly verdict: SignalVerdict,
    private readonly records: SealingRecords,
  ) {}

  /** The payload of a sealed signal; throws CallSignalRefusedError. */
  public async open(
    session: Session,
    signal: SealedCallSignal,
  ): Promise<Record<string, unknown>> {
    return (await this.verdict.receive(session, signal)).payload;
  }

  public async publishSealingRecords(session: Session): Promise<void> {
    await this.records.publish(session);
  }

  public async send(
    session: Session,
    callId: string,
    signal: CallSignalPayload,
  ): Promise<CallSignalDeliveryResource> {
    const delivery = await this.sender.send(
      new SendCallSignalMessage({
        actorIdentityId: this.sessions.register(session),
        callId,
        ...signal,
      }),
    );

    return delivery.toPrimitives();
  }
}
