import type { CallSignalDelivery } from '../../domain/entities/CallSignalDelivery';
import type { CallSignalRepository } from '../../domain/repositories/CallSignalRepository';

import { SendCallSignalMessage } from './messages/SendCallSignalMessage';

export class CallSignalSender {
  public constructor(
    private readonly callSignalRepository: CallSignalRepository,
  ) {}

  public async send(
    message: SendCallSignalMessage,
  ): Promise<CallSignalDelivery> {
    return await this.callSignalRepository.create(
      message.getCallId(),
      message.getActorIdentityId(),
      message.getSignal(),
    );
  }
}
