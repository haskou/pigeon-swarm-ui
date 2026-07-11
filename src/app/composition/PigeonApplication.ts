import type { LoginIdentityProgressReporter } from '../../contexts/identities/application/ports/LoginIdentityProgressReporter';
import type {
  IdentityPresence,
  LoginResult,
  Session,
  SelectablePresenceStatus,
} from '../../shared/domain/pigeonResources.types';

import { ConversationTimeline } from '../../contexts/conversations/domain/ConversationTimeline';
import {
  RealtimeGateway,
  type RealtimeHeartbeatActivityMode,
  type RealtimeMessage,
  type RealtimeTypingInput,
} from '../../shared/infrastructure/realtime/RealtimeGateway';
import { PigeonApiGateway } from './PigeonApiGateway';
import { PigeonAttachmentsApplication } from './PigeonAttachmentsApplication';
import { PigeonCallsApplication } from './PigeonCallsApplication';
import { PigeonCommunitiesApplication } from './PigeonCommunitiesApplication';
import { PigeonConversationsApplication } from './PigeonConversationsApplication';
import { PigeonIdentitiesApplication } from './PigeonIdentitiesApplication';
import { PigeonMessagesApplication } from './PigeonMessagesApplication';
import { PigeonNetworksApplication } from './PigeonNetworksApplication';
import { PigeonNotificationsApplication } from './PigeonNotificationsApplication';
import { PigeonPollsApplication } from './PigeonPollsApplication';
import { PigeonRealtimeApplication } from './PigeonRealtimeApplication';
import { PigeonStickersApplication } from './PigeonStickersApplication';

export class PigeonApplication {
  private readonly gateway: PigeonApiGateway;

  private readonly realtimeApplication: PigeonRealtimeApplication;

  public readonly attachments: PigeonAttachmentsApplication;

  public readonly calls: PigeonCallsApplication;

  public readonly communities: PigeonCommunitiesApplication;

  public readonly conversations: PigeonConversationsApplication;

  public readonly identities: PigeonIdentitiesApplication;

  public readonly messages: PigeonMessagesApplication;

  public readonly networks: PigeonNetworksApplication;

  public readonly notifications: PigeonNotificationsApplication;

  public readonly polls: PigeonPollsApplication;

  public readonly stickers: PigeonStickersApplication;

  public constructor(
    gateway: PigeonApiGateway = new PigeonApiGateway(),
    realtime: RealtimeGateway = new RealtimeGateway(),
  ) {
    this.gateway = gateway;
    this.attachments = new PigeonAttachmentsApplication(gateway);
    this.calls = new PigeonCallsApplication(gateway);
    this.communities = new PigeonCommunitiesApplication(gateway);
    this.conversations = new PigeonConversationsApplication(gateway);
    this.identities = new PigeonIdentitiesApplication(gateway);
    this.messages = new PigeonMessagesApplication(gateway);
    this.networks = new PigeonNetworksApplication(gateway);
    this.notifications = new PigeonNotificationsApplication(gateway);
    this.polls = new PigeonPollsApplication(gateway);
    this.realtimeApplication = new PigeonRealtimeApplication(realtime);
    this.stickers = new PigeonStickersApplication(gateway);
  }

  public async getPresence(
    session: Session,
    identityId: string,
  ): Promise<IdentityPresence> {
    return await this.gateway.getPresence(session, identityId);
  }

  public async getPresences(
    session: Session,
    identityIds: string[],
  ): Promise<IdentityPresence[]> {
    return await this.gateway.getPresences(session, identityIds);
  }

  public async updatePresence(
    session: Session,
    input: { status: SelectablePresenceStatus },
  ): Promise<IdentityPresence> {
    return await this.gateway.updatePresence(session, input);
  }

  public async connectRealtime(
    session: Session,
    onMessage: (message: RealtimeMessage) => void,
  ): Promise<WebSocket> {
    return await this.realtimeApplication.connect(session, onMessage);
  }

  public setRealtimeHeartbeatActivityMode(
    session: Session,
    mode: RealtimeHeartbeatActivityMode,
  ): void {
    this.realtimeApplication.setHeartbeatActivityMode(session, mode);
  }

  public sendRealtimeTyping(
    socket: WebSocket,
    input: RealtimeTypingInput,
  ): void {
    this.realtimeApplication.sendTyping(socket, input);
  }

  public acknowledgeRealtimeCallSignal(
    socket: WebSocket,
    signalId: string,
  ): void {
    this.realtimeApplication.acknowledgeCallSignal(socket, signalId);
  }

  public async restoreRememberedSession(
    identityId: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    const result = await this.gateway.restoreRememberedSession(
      identityId,
      onProgress,
    );

    return {
      ...result,
      conversations: ConversationTimeline.sortByLatestMessage(
        result.conversations,
      ),
    };
  }

  public async refreshSession(session: Session): Promise<LoginResult> {
    const result = await this.gateway.refreshSession(session);

    return {
      ...result,
      conversations: ConversationTimeline.sortByLatestMessage(
        result.conversations,
      ),
    };
  }
}
