import type { CallParticipantMediaConnectionResource } from '../../../contexts/calls/infrastructure/http/resources/CallParticipantMediaConnectionResource';
import type { CallResource } from '../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { Session } from '../../../shared/domain/pigeonResources.types';

import { CallEnder } from '../../../contexts/calls/application/end-call/CallEnder';
import { EndCallMessage } from '../../../contexts/calls/application/end-call/messages/EndCallMessage';
import { CallParticipantHeartbeater } from '../../../contexts/calls/application/heartbeat-participant/CallParticipantHeartbeater';
import { HeartbeatCallParticipantMessage } from '../../../contexts/calls/application/heartbeat-participant/messages/HeartbeatCallParticipantMessage';
import { CallJoiner } from '../../../contexts/calls/application/join-call/CallJoiner';
import { JoinCallMessage } from '../../../contexts/calls/application/join-call/messages/JoinCallMessage';
import { CallLeaver } from '../../../contexts/calls/application/leave-call/CallLeaver';
import { LeaveCallMessage } from '../../../contexts/calls/application/leave-call/messages/LeaveCallMessage';
import { CallMapper } from '../../../contexts/calls/infrastructure/http/CallMapper';
import { PigeonCallsApi } from '../../../contexts/calls/infrastructure/http/PigeonCallsApi';
import { CallSessionRegistrar } from './CallSessionRegistrar';

export class PigeonCallParticipation {
  public constructor(
    private readonly api: PigeonCallsApi,
    private readonly sessions: CallSessionRegistrar,
    private readonly mapper: CallMapper,
    private readonly joiner: CallJoiner,
    private readonly leaver: CallLeaver,
    private readonly heartbeater: CallParticipantHeartbeater,
    private readonly ender: CallEnder,
  ) {}

  public async end(session: Session, callId: string): Promise<void> {
    await this.ender.end(
      new EndCallMessage(callId, this.sessions.register(session), Date.now()),
    );
  }

  public async heartbeat(
    session: Session,
    callId: string,
    mediaConnections: CallParticipantMediaConnectionResource[],
  ): Promise<CallResource> {
    const call = await this.heartbeater.heartbeat(
      new HeartbeatCallParticipantMessage({
        actorIdentityId: this.sessions.register(session),
        callId,
        mediaConnections,
        occurredAt: Date.now(),
      }),
    );

    return this.mapper.toResource(call);
  }

  public async join(session: Session, callId: string): Promise<CallResource> {
    const call = await this.joiner.join(
      new JoinCallMessage(callId, this.sessions.register(session), Date.now()),
    );

    return this.mapper.toResource(call);
  }

  public async leave(session: Session, callId: string): Promise<void> {
    await this.leaver.leave(
      new LeaveCallMessage(callId, this.sessions.register(session), Date.now()),
    );
  }

  public async leaveOnPageDeparture(
    session: Session,
    callId: string,
  ): Promise<void> {
    await this.api.leave(session, callId);
  }
}
