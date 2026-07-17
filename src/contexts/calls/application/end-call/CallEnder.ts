import type { CallRepository } from '../../domain/repositories/CallRepository';

import { EndCallMessage } from './messages/EndCallMessage';

export class CallEnder {
  public constructor(private readonly callRepository: CallRepository) {}

  public async end(message: EndCallMessage): Promise<void> {
    const actorIdentityId = message.getActorIdentityId();
    const call = await this.callRepository.find(
      message.getCallId(),
      actorIdentityId,
    );

    call.end(message.getOccurredAt());
    await this.callRepository.end(call, actorIdentityId);
  }
}
