import type { IdentityUpdateProfileInput } from '../domain/identities/IdentitySignaturePayloadFactory';
import type {
  AttachmentProgress,
  ChatMessage,
  ConversationResource,
  IdentityResource,
  LocalKeychain,
  LoginResult,
  MessageAttachment,
  NotificationResource,
  PublicFileContent,
  PublicFileUpload,
  SendMessageOptions,
  Session,
} from '../domain/types';

import { PigeonApiGateway } from '../infrastructure/pigeon-api/PigeonApiGateway';
import {
  RealtimeGateway,
  type RealtimeMessage,
} from '../infrastructure/realtime/RealtimeGateway';
import { CreateConversation } from './conversations/CreateConversation';
import { ListConversations } from './conversations/ListConversations';
import { LoginIdentity } from './identities/LoginIdentity';
import { RegisterIdentity } from './identities/RegisterIdentity';
import { DeleteMessage } from './messages/DeleteMessage';
import { LoadMessage } from './messages/LoadMessage';
import { LoadMessages } from './messages/LoadMessages';
import { LoadMessagesAround } from './messages/LoadMessagesAround';
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
import { ListPeers, type Peer } from './peers/ListPeers';

export class PigeonApplication {
  private readonly gateway: PigeonApiGateway;

  private readonly realtime: RealtimeGateway;

  private readonly acceptConversationInvitationUseCase: AcceptInvitation;

  private readonly createConversationUseCase: CreateConversation;

  private readonly createNetworkUseCase: CreateNetwork;

  private readonly joinNetworkUseCase: JoinNetwork;

  private readonly deleteMessageUseCase: DeleteMessage;

  private readonly listConversationsUseCase: ListConversations;

  private readonly listNodeNetworksUseCase: ListNodeNetworks;

  private readonly listNotificationsUseCase: ListNotifications;

  private readonly listPeersUseCase: ListPeers;

  private readonly loadMessagesUseCase: LoadMessages;

  private readonly loadMessageUseCase: LoadMessage;

  private readonly loadMessagesAroundUseCase: LoadMessagesAround;

  private readonly loginIdentityUseCase: LoginIdentity;

  private readonly registerIdentityUseCase: RegisterIdentity;

  private readonly sendMessageUseCase: SendMessage;

  private readonly updateNotificationUseCase: UpdateNotification;

  public constructor(
    gateway: PigeonApiGateway = new PigeonApiGateway(),
    realtime: RealtimeGateway = new RealtimeGateway(),
  ) {
    this.gateway = gateway;
    this.realtime = realtime;
    this.acceptConversationInvitationUseCase = new AcceptInvitation(gateway);
    this.createConversationUseCase = new CreateConversation(gateway);
    this.createNetworkUseCase = new CreateNetwork(gateway);
    this.deleteMessageUseCase = new DeleteMessage(gateway);
    this.joinNetworkUseCase = new JoinNetwork(gateway);
    this.listConversationsUseCase = new ListConversations(gateway);
    this.listNodeNetworksUseCase = new ListNodeNetworks(gateway);
    this.listNotificationsUseCase = new ListNotifications(gateway);
    this.listPeersUseCase = new ListPeers(gateway);
    this.loadMessageUseCase = new LoadMessage(gateway);
    this.loadMessagesAroundUseCase = new LoadMessagesAround(gateway);
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

  public async connectRealtime(
    session: Session,
    onMessage: (message: RealtimeMessage) => void,
  ): Promise<WebSocket> {
    return await this.realtime.connect(session, onMessage);
  }

  public async createConversation(
    session: Session,
    peerIdentityId: string,
    networkId: string,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    return await this.createConversationUseCase.execute(
      session,
      peerIdentityId,
      networkId,
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

  public async getPublicFile(cid: string): Promise<PublicFileContent> {
    return await this.gateway.getPublicFile(cid);
  }

  public async downloadAttachment(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    return await this.gateway.downloadAttachment(attachment, onProgress);
  }

  public async deleteMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.deleteMessageUseCase.execute(session, conversationId, messageId);
  }

  public async updateIdentityProfile(
    session: Session,
    profile: IdentityUpdateProfileInput,
    newPassword?: string,
  ): Promise<IdentityResource> {
    return await this.gateway.updateIdentityProfile(
      session,
      profile,
      newPassword,
    );
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

  public async listNodeNetworks(session?: Session): Promise<NodeNetwork[]> {
    return await this.listNodeNetworksUseCase.execute(session);
  }

  public async listNotifications(
    session: Session,
  ): Promise<NotificationResource[]> {
    return await this.listNotificationsUseCase.execute(session);
  }

  public async listPeers(): Promise<Peer[]> {
    return await this.listPeersUseCase.execute();
  }

  public async publishKeychain(
    session: Session,
    nextKeychain: LocalKeychain,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> {
    return await this.gateway.publishKeychain(session, nextKeychain);
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

  public async loadMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<ChatMessage | null> {
    return await this.loadMessageUseCase.execute(
      session,
      conversationId,
      messageId,
    );
  }

  public async loadMessagesAround(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<{
    messages: ChatMessage[];
    nextCursor?: null | string;
    previousCursor?: null | string;
  }> {
    return await this.loadMessagesAroundUseCase.execute(
      session,
      conversationId,
      messageId,
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
    options: SendMessageOptions = {},
  ): Promise<ChatMessage> {
    return await this.sendMessageUseCase.execute(
      session,
      conversationId,
      content,
      options,
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
