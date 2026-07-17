import type { CallSignalDeliveryResource } from '../../../contexts/calls/infrastructure/http/resources/CallSignalDeliveryResource';
import type { CallSignalPayload } from '../../../contexts/calls/infrastructure/media/CallSignalPayload';
import type { Session } from '../../../shared/domain/pigeonResources.types';

import { CallSignalSender } from '../../../contexts/calls/application/send-call-signal/CallSignalSender';
import { SendCallSignalMessage } from '../../../contexts/calls/application/send-call-signal/messages/SendCallSignalMessage';
import { CallSessionRegistrar } from './CallSessionRegistrar';

export class PigeonCallSignaling {
  public constructor(
    private readonly sessions: CallSessionRegistrar,
    private readonly sender: CallSignalSender,
  ) {}

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
