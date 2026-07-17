import type { CallSignalDelivery } from '../../domain/entities/CallSignalDelivery';
import type { CallSignalRepository } from '../../domain/repositories/CallSignalRepository';

import { SendCallSignalMessage } from './messages/SendCallSignalMessage';

export class CallSignalSender {
  public constructor(private readonly repository: CallSignalRepository) {}

  public async send(
    message: SendCallSignalMessage,
  ): Promise<CallSignalDelivery> {
    return await this.repository.create(
      message.getCallId(),
      message.getActorIdentityId(),
      message.getSignal(),
    );
  }
}
