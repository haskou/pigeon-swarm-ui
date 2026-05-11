import type { IdentityUpdateProfileInput } from '../domain/identities/IdentitySignaturePayloadFactory';
import type {
  ChatMessage,
  ConversationResource,
  IdentityResource,
  LocalKeychain,
  LoginResult,
  NotificationResource,
  PublicFileUpload,
  Session,
} from '../domain/types';

import { PigeonApiGateway } from '../infrastructure/pigeon-api/PigeonApiGateway';
import { CreateConversation } from './conversations/CreateConversation';
import { ListConversations } from './conversations/ListConversations';
import { LoginIdentity } from './identities/LoginIdentity';
import { RegisterIdentity } from './identities/RegisterIdentity';
import { LoadMessages } from './messages/LoadMessages';
import { SendMessage } from './messages/SendMessage';
import { CreateNetwork } from './networks/CreateNetwork';
import { JoinNetwork } from './networks/JoinNetwork';
import {
  ListNodeNetworks,
  type NodeNetwork,
} from './networks/ListNodeNetworks';
import {
  AcceptInvitation,
  ListNotifications,
  UpdateNotification,
} from './notifications';

export class PigeonApplication {
  private readonly gateway: PigeonApiGateway;

  private readonly acceptConversationInvitationUseCase: AcceptInvitation;

  private readonly createConversationUseCase: CreateConversation;

  private readonly createNetworkUseCase: CreateNetwork;

  private readonly joinNetworkUseCase: JoinNetwork;

  private readonly listConversationsUseCase: ListConversations;

  private readonly listNodeNetworksUseCase: ListNodeNetworks;

  private readonly listNotificationsUseCase: ListNotifications;

  private readonly loadMessagesUseCase: LoadMessages;

  private readonly loginIdentityUseCase: LoginIdentity;

  private readonly registerIdentityUseCase: RegisterIdentity;

  private readonly sendMessageUseCase: SendMessage;

  private readonly updateNotificationUseCase: UpdateNotification;

  public constructor(gateway: PigeonApiGateway = new PigeonApiGateway()) {
    this.gateway = gateway;
    this.acceptConversationInvitationUseCase = new AcceptInvitation(gateway);
    this.createConversationUseCase = new CreateConversation(gateway);
    this.createNetworkUseCase = new CreateNetwork(gateway);
    this.joinNetworkUseCase = new JoinNetwork(gateway);
    this.listConversationsUseCase = new ListConversations(gateway);
    this.listNodeNetworksUseCase = new ListNodeNetworks(gateway);
    this.listNotificationsUseCase = new ListNotifications(gateway);
    this.loadMessagesUseCase = new LoadMessages(gateway);
    this.loginIdentityUseCase = new LoginIdentity(gateway);
    this.registerIdentityUseCase = new RegisterIdentity(gateway);
    this.sendMessageUseCase = new SendMessage(gateway);
    this.updateNotificationUseCase = new UpdateNotification(gateway);
  }

  public async acceptConversationInvitation(
    session: Session,
    notification: NotificationResource,
  ): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
    notification: NotificationResource;
  }> {
    return await this.acceptConversationInvitationUseCase.execute(
      session,
      notification,
    );
  }

  public async claimNode(session: Session): Promise<void> {
    await this.gateway.claimNode(session);
  }

  public async createConversation(
    session: Session,
    peerIdentityId: string,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    return await this.createConversationUseCase.execute(
      session,
      peerIdentityId,
    );
  }

  public async createNetwork(name: string): Promise<void> {
    await this.createNetworkUseCase.execute(name);
  }

  public async createNodeNetwork(
    session: Session,
    name: string,
  ): Promise<void> {
    await this.gateway.createNetwork(name, session);
  }

  public async joinNetwork(
    id: string,
    name: string,
    key: string,
  ): Promise<void> {
    await this.joinNetworkUseCase.execute(id, name, key);
  }

  public async joinNodeNetwork(
    session: Session,
    id: string,
    name: string,
    key: string,
  ): Promise<void> {
    await this.gateway.joinNetwork(id, name, key, session);
  }

  public async getNodeInfo(): Promise<{ id: string; owner: string | null }> {
    return await this.gateway.getNodeInfo();
  }

  public async getIdentity(identityId: string): Promise<IdentityResource> {
    return await this.gateway.getIdentity(identityId);
  }

  public async updateIdentityProfile(
    session: Session,
    profile: IdentityUpdateProfileInput,
  ): Promise<IdentityResource> {
    return await this.gateway.updateIdentityProfile(session, profile);
  }

  public async uploadPublicFile(
    session: Session,
    file: File,
  ): Promise<PublicFileUpload> {
    return await this.gateway.uploadPublicFile(session, file);
  }

  public async listConversations(
    session: Session,
  ): Promise<ConversationResource[]> {
    return await this.listConversationsUseCase.execute(session);
  }

  public async listNodeNetworks(): Promise<NodeNetwork[]> {
    return await this.listNodeNetworksUseCase.execute();
  }

  public async listNotifications(
    session: Session,
  ): Promise<NotificationResource[]> {
    return await this.listNotificationsUseCase.execute(session);
  }

  public async loadMessages(
    session: Session,
    conversationId: string,
    before?: null | string,
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> {
    return await this.loadMessagesUseCase.execute(
      session,
      conversationId,
      before,
    );
  }

  public async login(
    identityId: string,
    password: string,
  ): Promise<LoginResult> {
    return await this.loginIdentityUseCase.execute(identityId, password);
  }

  public async register(
    name: string,
    password: string,
    networks: string[],
    handle?: string,
  ): Promise<LoginResult> {
    return await this.registerIdentityUseCase.execute(
      name,
      password,
      networks,
      handle,
    );
  }

  public async sendMessage(
    session: Session,
    conversationId: string,
    content: string,
    previousMessageIds: string[] = [],
  ): Promise<ChatMessage> {
    return await this.sendMessageUseCase.execute(
      session,
      conversationId,
      content,
      previousMessageIds,
    );
  }

  public async updateNotification(
    session: Session,
    notificationId: string,
    state: 'accepted' | 'declined',
  ): Promise<NotificationResource> {
    return await this.updateNotificationUseCase.execute(
      session,
      notificationId,
      state,
    );
  }
}
