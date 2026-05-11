import type {
  ChatMessage,
  ConversationResource,
  LocalKeychain,
  LoginResult,
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

export class PigeonApplication {
  private readonly createConversationUseCase: CreateConversation;

  private readonly createNetworkUseCase: CreateNetwork;

  private readonly joinNetworkUseCase: JoinNetwork;

  private readonly listConversationsUseCase: ListConversations;

  private readonly listNodeNetworksUseCase: ListNodeNetworks;

  private readonly loadMessagesUseCase: LoadMessages;

  private readonly loginIdentityUseCase: LoginIdentity;

  private readonly registerIdentityUseCase: RegisterIdentity;

  private readonly sendMessageUseCase: SendMessage;

  public constructor(gateway: PigeonApiGateway = new PigeonApiGateway()) {
    this.createConversationUseCase = new CreateConversation(gateway);
    this.createNetworkUseCase = new CreateNetwork(gateway);
    this.joinNetworkUseCase = new JoinNetwork(gateway);
    this.listConversationsUseCase = new ListConversations(gateway);
    this.listNodeNetworksUseCase = new ListNodeNetworks(gateway);
    this.loadMessagesUseCase = new LoadMessages(gateway);
    this.loginIdentityUseCase = new LoginIdentity(gateway);
    this.registerIdentityUseCase = new RegisterIdentity(gateway);
    this.sendMessageUseCase = new SendMessage(gateway);
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

  public async joinNetwork(
    id: string,
    name: string,
    key: string,
  ): Promise<void> {
    await this.joinNetworkUseCase.execute(id, name, key);
  }

  public async listConversations(
    session: Session,
  ): Promise<ConversationResource[]> {
    return await this.listConversationsUseCase.execute(session);
  }

  public async listNodeNetworks(): Promise<NodeNetwork[]> {
    return await this.listNodeNetworksUseCase.execute();
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
  ): Promise<LoginResult> {
    return await this.registerIdentityUseCase.execute(name, password, networks);
  }

  public async sendMessage(
    session: Session,
    conversationId: string,
    content: string,
  ): Promise<ChatMessage> {
    return await this.sendMessageUseCase.execute(
      session,
      conversationId,
      content,
    );
  }
}
