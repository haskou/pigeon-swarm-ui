import type { Call } from '../../domain/Call';
import type { CallRepository } from '../../domain/repositories/CallRepository';

import { HeartbeatCallParticipantMessage } from './messages/HeartbeatCallParticipantMessage';

export class CallParticipantHeartbeater {
  public constructor(private readonly callRepository: CallRepository) {}

  public async heartbeat(
    message: HeartbeatCallParticipantMessage,
  ): Promise<Call> {
    const actorIdentityId = message.getActorIdentityId();
    const call = await this.callRepository.find(
      message.getCallId(),
      actorIdentityId,
    );
    const mediaConnections = message.getMediaConnections();

    call.heartbeatParticipant(
      actorIdentityId,
      message.getOccurredAt(),
      mediaConnections,
    );

    return await this.callRepository.heartbeat(
      call,
      actorIdentityId,
      mediaConnections,
    );
  }
}
