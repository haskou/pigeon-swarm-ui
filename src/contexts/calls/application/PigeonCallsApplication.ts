import type { Session } from '../../../shared/domain/pigeonResources.types';
import type {
  CallIceServerConfig,
  CallParticipantMediaConnection,
  CallResource,
  CallSignalDelivery,
  CallSignalPayload,
} from '../domain/callSession.types';
import type { CallApplicationPort } from './ports/CallApplicationPort';

import { ListCalls } from './list-calls/ListCalls';
import { ListCallsMessage } from './list-calls/messages/ListCallsMessage';

export class PigeonCallsApplication {
  private readonly listCallsUseCase: ListCalls;

  public constructor(private readonly gateway: CallApplicationPort) {
    this.listCallsUseCase = new ListCalls({
      list: async (message) => await gateway.list(message.getSession()),
    });
  }

  public async list(session: Session): Promise<CallResource[]> {
    return await this.listCallsUseCase.list(new ListCallsMessage(session));
  }

  public async get(session: Session, callId: string): Promise<CallResource> {
    return await this.gateway.get(session, callId);
  }

  public async getIceServers(session: Session): Promise<CallIceServerConfig> {
    return await this.gateway.getIceServers(session);
  }

  public async startConversation(
    session: Session,
    conversationId: string,
  ): Promise<CallResource> {
    return await this.gateway.startConversation(session, conversationId);
  }

  public async startCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<CallResource> {
    return await this.gateway.startCommunityChannel(
      session,
      communityId,
      channelId,
    );
  }

  public async join(session: Session, callId: string): Promise<CallResource> {
    return await this.gateway.join(session, callId);
  }

  public async leave(session: Session, callId: string): Promise<void> {
    await this.gateway.leave(session, callId);
  }

  public async heartbeatParticipant(
    session: Session,
    callId: string,
    mediaConnections: CallParticipantMediaConnection[],
  ): Promise<CallResource> {
    return await this.gateway.heartbeat(session, callId, mediaConnections);
  }

  public async end(session: Session, callId: string): Promise<void> {
    await this.gateway.end(session, callId);
  }

  public async sendSignal(
    session: Session,
    callId: string,
    signal: CallSignalPayload,
  ): Promise<CallSignalDelivery> {
    return await this.gateway.sendSignal(session, callId, signal);
  }
}
