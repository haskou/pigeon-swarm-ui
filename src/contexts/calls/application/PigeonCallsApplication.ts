import type { Session } from '../../../shared/domain/pigeonResources.types';
import type {
  CallIceServerConfig,
  CallParticipantMediaConnection,
  CallResource,
  CallSignalDelivery,
  CallSignalPayload,
} from '../domain/callSession.types';
import type { EndCallPort } from './end-call/EndCallPort';
import type { GetCallPort } from './get-call/GetCallPort';
import type { GetIceServersPort } from './get-ice-servers/GetIceServersPort';
import type { HeartbeatParticipantPort } from './heartbeat-participant/HeartbeatParticipantPort';
import type { JoinCallPort } from './join-call/JoinCallPort';
import type { LeaveCallPort } from './leave-call/LeaveCallPort';
import type { ListCallsPort } from './list-calls/ListCallsPort';
import type { SendCallSignalPort } from './send-call-signal/SendCallSignalPort';
import type { StartCommunityChannelCallPort } from './start-community-channel-call/StartCommunityChannelCallPort';
import type { StartConversationCallPort } from './start-conversation-call/StartConversationCallPort';

import { ListCalls } from './list-calls/ListCalls';
import { ListCallsMessage } from './list-calls/messages/ListCallsMessage';

export class PigeonCallsApplication {
  private readonly listCallsUseCase: ListCalls;

  public constructor(
    private readonly dependencies: {
      endCall: EndCallPort;
      getCall: GetCallPort;
      getIceServers: GetIceServersPort;
      heartbeatParticipant: HeartbeatParticipantPort;
      joinCall: JoinCallPort;
      leaveCall: LeaveCallPort;
      listCalls: ListCallsPort;
      sendCallSignal: SendCallSignalPort;
      startCommunityChannelCall: StartCommunityChannelCallPort;
      startConversationCall: StartConversationCallPort;
    },
  ) {
    this.listCallsUseCase = new ListCalls({
      list: async (message) => await dependencies.listCalls.list(message),
    });
  }

  public async list(session: Session): Promise<CallResource[]> {
    return await this.listCallsUseCase.list(new ListCallsMessage(session));
  }

  public async get(session: Session, callId: string): Promise<CallResource> {
    return await this.dependencies.getCall.get(session, callId);
  }

  public async getIceServers(session: Session): Promise<CallIceServerConfig> {
    return await this.dependencies.getIceServers.getIceServers(session);
  }

  public async startConversation(
    session: Session,
    conversationId: string,
  ): Promise<CallResource> {
    return await this.dependencies.startConversationCall.startConversation(
      session,
      conversationId,
    );
  }

  public async startCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<CallResource> {
    const startCommunityChannelCall =
      this.dependencies.startCommunityChannelCall;

    return await startCommunityChannelCall.startCommunityChannel(
      session,
      communityId,
      channelId,
    );
  }

  public async join(session: Session, callId: string): Promise<CallResource> {
    return await this.dependencies.joinCall.join(session, callId);
  }

  public async leave(session: Session, callId: string): Promise<void> {
    await this.dependencies.leaveCall.leave(session, callId);
  }

  public async heartbeatParticipant(
    session: Session,
    callId: string,
    mediaConnections: CallParticipantMediaConnection[],
  ): Promise<CallResource> {
    return await this.dependencies.heartbeatParticipant.heartbeat(
      session,
      callId,
      mediaConnections,
    );
  }

  public async end(session: Session, callId: string): Promise<void> {
    await this.dependencies.endCall.end(session, callId);
  }

  public async sendSignal(
    session: Session,
    callId: string,
    signal: CallSignalPayload,
  ): Promise<CallSignalDelivery> {
    return await this.dependencies.sendCallSignal.sendSignal(
      session,
      callId,
      signal,
    );
  }
}
