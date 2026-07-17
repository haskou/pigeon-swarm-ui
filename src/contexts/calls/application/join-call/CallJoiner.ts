import type { Call } from '../../domain/Call';
import type { CallRepository } from '../../domain/repositories/CallRepository';

import { JoinCallMessage } from './messages/JoinCallMessage';

export class CallJoiner {
  public constructor(private readonly calls: CallRepository) {}

  public async join(message: JoinCallMessage): Promise<Call> {
    const actorIdentityId = message.getActorIdentityId();
    const call = await this.calls.find(message.getCallId(), actorIdentityId);

    call.joinParticipant(actorIdentityId, message.getOccurredAt());

    return await this.calls.join(call, actorIdentityId);
  }
}
