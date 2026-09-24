import type { CallRepository } from '../../domain/repositories/CallRepository';

import { HeartbeatCallParticipantMessage } from './messages/HeartbeatCallParticipantMessage';

export class CallParticipantHeartbeater {
  public constructor(private readonly callRepository: CallRepository) {}

  public async heartbeat(
    message: HeartbeatCallParticipantMessage,
  ): Promise<void> {
    await this.callRepository.heartbeat(
      message.getCallId(),
      message.getActorIdentityId(),
      message.getMediaConnections(),
    );
  }
}
