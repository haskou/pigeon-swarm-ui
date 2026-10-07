import type { CallRepository } from '../../domain/repositories/CallRepository';

import { CallParticipantStatus } from '../../domain/value-objects/CallParticipantStatus';
import { LeaveCallMessage } from './messages/LeaveCallMessage';

export class CallLeaver {
  public constructor(private readonly callRepository: CallRepository) {}

  public async leave(message: LeaveCallMessage): Promise<void> {
    const actorIdentityId = message.getActorIdentityId();
    const call = await this.callRepository.find(
      message.getCallId(),
      actorIdentityId,
    );

    // A leave while still ringing is signed as a decline.
    const declined = call.hasParticipantStatus(
      actorIdentityId,
      CallParticipantStatus.RINGING,
    );

    call.leaveParticipant(actorIdentityId, message.getOccurredAt());
    await this.callRepository.leave(
      call,
      actorIdentityId,
      message.getOccurredAt(),
      declined,
    );
  }
}
