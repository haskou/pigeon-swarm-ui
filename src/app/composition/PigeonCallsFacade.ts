import type { CallIceServerResource } from '../../contexts/calls/infrastructure/http/resources/CallIceServerResource';
import type { CallParticipantMediaConnectionResource } from '../../contexts/calls/infrastructure/http/resources/CallParticipantMediaConnectionResource';
import type { CallResource } from '../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallSignalDeliveryResource } from '../../contexts/calls/infrastructure/http/resources/CallSignalDeliveryResource';
import type { CallSignalPayload } from '../../contexts/calls/infrastructure/media/CallSignalPayload';
import type { Session } from '../../shared/domain/pigeonResources.types';

import { PigeonCallParticipation } from './calls/PigeonCallParticipation';
import { PigeonCallReader } from './calls/PigeonCallReader';
import { PigeonCallSignaling } from './calls/PigeonCallSignaling';
import { PigeonCallStarter } from './calls/PigeonCallStarter';

export class PigeonCallsFacade {
  public constructor(
    private readonly reader: PigeonCallReader,
    private readonly starter: PigeonCallStarter,
    private readonly participation: PigeonCallParticipation,
    private readonly signaling: PigeonCallSignaling,
  ) {}

  public async end(session: Session, callId: string): Promise<void> {
    await this.participation.end(session, callId);
  }

  public async get(session: Session, callId: string): Promise<CallResource> {
    return await this.reader.find(session, callId);
  }

  public async getIceServers(session: Session): Promise<CallIceServerResource> {
    return await this.reader.getIceServers(session);
  }

  public async heartbeatParticipant(
    session: Session,
    callId: string,
    mediaConnections: CallParticipantMediaConnectionResource[],
  ): Promise<CallResource> {
    return await this.participation.heartbeat(
      session,
      callId,
      mediaConnections,
    );
  }

  public async join(session: Session, callId: string): Promise<CallResource> {
    return await this.participation.join(session, callId);
  }

  public async leave(session: Session, callId: string): Promise<void> {
    await this.participation.leave(session, callId);
  }

  public async leaveOnPageDeparture(
    session: Session,
    callId: string,
  ): Promise<void> {
    await this.participation.leaveOnPageDeparture(session, callId);
  }

  public async list(session: Session): Promise<CallResource[]> {
    return await this.reader.search(session);
  }

  public async sendSignal(
    session: Session,
    callId: string,
    signal: CallSignalPayload,
  ): Promise<CallSignalDeliveryResource> {
    return await this.signaling.send(session, callId, signal);
  }

  public async startCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<CallResource> {
    return await this.starter.startCommunityChannel(
      session,
      communityId,
      channelId,
    );
  }

  public async startConversation(
    session: Session,
    conversationId: string,
  ): Promise<CallResource> {
    return await this.starter.startConversation(session, conversationId);
  }
}
