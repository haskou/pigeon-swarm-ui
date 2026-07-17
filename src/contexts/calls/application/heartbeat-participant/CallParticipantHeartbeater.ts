import type { Call } from '../../domain/Call';
import type { CallRepository } from '../../domain/repositories/CallRepository';

import { HeartbeatCallParticipantMessage } from './messages/HeartbeatCallParticipantMessage';

export class CallParticipantHeartbeater {
  public constructor(private readonly calls: CallRepository) {}

  public async heartbeat(
    message: HeartbeatCallParticipantMessage,
  ): Promise<Call> {
    const actorIdentityId = message.getActorIdentityId();
    const call = await this.calls.find(message.getCallId(), actorIdentityId);
    const mediaConnections = message.getMediaConnections();

    call.heartbeatParticipant(
      actorIdentityId,
      message.getOccurredAt(),
      mediaConnections,
    );

    return await this.calls.heartbeat(call, actorIdentityId, mediaConnections);
  }
}
