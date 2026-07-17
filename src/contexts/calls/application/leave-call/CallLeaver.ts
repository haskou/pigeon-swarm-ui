import type { CallRepository } from '../../domain/repositories/CallRepository';

import { LeaveCallMessage } from './messages/LeaveCallMessage';

export class CallLeaver {
  public constructor(private readonly calls: CallRepository) {}

  public async leave(message: LeaveCallMessage): Promise<void> {
    const actorIdentityId = message.getActorIdentityId();
    const call = await this.calls.find(message.getCallId(), actorIdentityId);

    call.leaveParticipant(actorIdentityId, message.getOccurredAt());
    await this.calls.leave(call, actorIdentityId);
  }
}
