import type {
  CallIceServerConfig,
  CallResource,
  CallSignalPayload,
} from '../../contexts/calls/domain/callSession.types';
import type { Session } from '../../shared/domain/pigeonResources.types';

import { ListCalls } from '../../contexts/calls/application/list-calls/ListCalls';
import { ListCallsMessage } from '../../contexts/calls/application/list-calls/messages/ListCallsMessage';
import { PigeonApiGateway } from './PigeonApiGateway';

export class PigeonCallsApplication {
  private readonly listCallsUseCase: ListCalls;

  public constructor(private readonly gateway: PigeonApiGateway) {
    this.listCallsUseCase = new ListCalls({
      list: async (message) => await gateway.listCalls(message.getSession()),
    });
  }

  public async list(session: Session): Promise<CallResource[]> {
    return await this.listCallsUseCase.list(new ListCallsMessage(session));
  }

  public async get(session: Session, callId: string): Promise<CallResource> {
    return await this.gateway.getCall(session, callId);
  }

  public async getIceServers(session: Session): Promise<CallIceServerConfig> {
    return await this.gateway.getCallIceServers(session);
  }

  public async startConversation(
    session: Session,
    conversationId: string,
  ): Promise<CallResource> {
    return await this.gateway.startConversationCall(session, conversationId);
  }

  public async startCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<CallResource> {
    return await this.gateway.startCommunityChannelCall(
      session,
      communityId,
      channelId,
    );
  }

  public async join(session: Session, callId: string): Promise<CallResource> {
    return await this.gateway.joinCall(session, callId);
  }

  public async leave(session: Session, callId: string): Promise<void> {
    await this.gateway.leaveCall(session, callId);
  }

  public async heartbeatParticipant(
    session: Session,
    callId: string,
  ): Promise<void> {
    await this.gateway.heartbeatCallParticipant(session, callId);
  }

  public async end(session: Session, callId: string): Promise<void> {
    await this.gateway.endCall(session, callId);
  }

  public async sendSignal(
    session: Session,
    callId: string,
    signal: CallSignalPayload,
  ): Promise<void> {
    await this.gateway.sendCallSignal(session, callId, signal);
  }
}
