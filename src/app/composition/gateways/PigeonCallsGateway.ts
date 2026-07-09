import type {
  CallIceServerConfig,
  CallResource,
  CallSignalPayload,
} from '../../../contexts/calls/domain/callSession.types';
import type { Session } from '../../../shared/domain/pigeonResources.types';

import { PigeonCallsApi } from '../../../contexts/calls/infrastructure/http/PigeonCallsApi';

export class PigeonCallsGateway {
  public constructor(private readonly calls: PigeonCallsApi) {}

  public async list(session: Session): Promise<CallResource[]> {
    return await this.calls.list(session);
  }

  public async get(session: Session, callId: string): Promise<CallResource> {
    return await this.calls.get(session, callId);
  }

  public async getIceServers(session: Session): Promise<CallIceServerConfig> {
    return await this.calls.getIceServers(session);
  }

  public async startConversation(
    session: Session,
    conversationId: string,
  ): Promise<CallResource> {
    return await this.calls.startConversation(session, conversationId);
  }

  public async startCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<CallResource> {
    return await this.calls.startCommunityChannel(
      session,
      communityId,
      channelId,
    );
  }

  public async join(session: Session, callId: string): Promise<CallResource> {
    return await this.calls.join(session, callId);
  }

  public async leave(session: Session, callId: string): Promise<void> {
    await this.calls.leave(session, callId);
  }

  public async heartbeat(
    session: Session,
    callId: string,
  ): Promise<CallResource> {
    return await this.calls.heartbeat(session, callId);
  }

  public async end(session: Session, callId: string): Promise<void> {
    await this.calls.end(session, callId);
  }

  public async sendSignal(
    session: Session,
    callId: string,
    signal: CallSignalPayload,
  ): Promise<void> {
    await this.calls.sendSignal(session, callId, signal);
  }
}
