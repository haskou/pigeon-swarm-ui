import { EncryptedPayload } from '@haskou/value-objects';

import type { CommunityChannelMessageEditInput } from '../../contexts/communities/infrastructure/http/CommunityChannelMessageEditInput';
import type { CommunityChannelMessageInput } from '../../contexts/communities/infrastructure/http/CommunityChannelMessageInput';
import type { CommunityInviteLinkInput } from '../../contexts/communities/infrastructure/http/CommunityInviteLinkInput';
import type { LoginIdentityProgressReporter } from '../../contexts/identities/application/login-identity/LoginIdentityProgressReporter';
import type { IdentityUpdateProfileInput } from '../../contexts/identities/domain/IdentitySignaturePayloadFactory';
import type { MessageDecryptWorkerPort } from '../../contexts/messages/infrastructure/crypto/MessageDecryptWorkerPort';
import type { MessageProjectionPort } from '../../contexts/messages/infrastructure/crypto/MessageProjectionPort';
import type { MessageLoadOptions } from '../../contexts/messages/infrastructure/http/MessageLoadOptions';
import type {
  ChatMessage,
  Community,
  CommunityChannel,
  CommunityDiscoveryResource,
  CommunityInviteLinkResource,
  CommunityMembershipRequest,
  CommunityMembershipRequestStatus,
  CommunityModerationLogPage,
  CommunityPermission,
  CommunityRoleResource,
  CommunityTextChannel,
  CommunityVisibility,
  CommunityVoiceChannel,
  CommunityChannelDraft,
  CommunityChannelMessagePinsResource,
  ConversationDraft,
  ConversationKeyEntry,
  ConversationResource,
  CreatePollInput,
  EditMessageOptions,
  AttachmentProgress,
  AttachmentUploadOptions,
  IdentityResource,
  KeychainResource,
  LocalKeychain,
  LoginResult,
  MessageAttachment,
  MessageLinkPreview,
  MessagePin,
  MessageResource,
  MyStickersResource,
  NotificationResource,
  NotificationScopeSetting,
  NotificationScopeSettingInput,
  NotificationSettingScope,
  PendingMessageAttachment,
  PrivateFileContent,
  PrivateFileUpload,
  PollResource,
  PublicFileContent,
  PublicFileUpload,
  SendMessageOptions,
  Session,
  StickerInput,
  StickerPackInput,
  StickerPackResource,
  StickerResource,
} from '../../shared/domain/pigeonResources.types';
import type { RequestCacheOptions } from '../../shared/infrastructure/http/RequestCacheOptions';

import { AttachmentCipher } from '../../contexts/attachments/infrastructure/crypto/AttachmentCipher';
import { PigeonFilesApi } from '../../contexts/attachments/infrastructure/http/PigeonFilesApi';
import { PigeonFilesGateway } from '../../contexts/attachments/infrastructure/http/PigeonFilesGateway';
import { PigeonCallsApi } from '../../contexts/calls/infrastructure/http/PigeonCallsApi';
import { PigeonCallsGateway } from '../../contexts/calls/infrastructure/http/PigeonCallsGateway';
import { PigeonCommunitiesApi } from '../../contexts/communities/infrastructure/http/PigeonCommunitiesApi';
import { PigeonCommunitiesGateway } from '../../contexts/communities/infrastructure/http/PigeonCommunitiesGateway';
import { PigeonCommunityInvitationApi } from '../../contexts/communities/infrastructure/http/PigeonCommunityInvitationApi';
import { ConversationIdFactory } from '../../contexts/conversations/domain/ConversationIdFactory';
import { ConversationKeychain } from '../../contexts/conversations/domain/ConversationKeychain';
import { ConversationMapper } from '../../contexts/conversations/infrastructure/http/ConversationMapper';
import { PigeonConversationCommandsApi } from '../../contexts/conversations/infrastructure/http/PigeonConversationCommandsApi';
import { PigeonConversationsApi } from '../../contexts/conversations/infrastructure/http/PigeonConversationsApi';
import { PigeonConversationsGateway } from '../../contexts/conversations/infrastructure/http/PigeonConversationsGateway';
import { IdentitySignaturePayloadFactory } from '../../contexts/identities/domain/IdentitySignaturePayloadFactory';
import { ProfileHandle } from '../../contexts/identities/domain/profile/ProfileHandle';
import { ProfileName } from '../../contexts/identities/domain/profile/ProfileName';
import { IdentityNetworkMemberships } from '../../contexts/identities/domain/value-objects/IdentityNetworkMemberships';
import { KeychainCipher } from '../../contexts/identities/infrastructure/crypto/KeychainCipher';
import { PigeonIdentityKeyProtectionGateway } from '../../contexts/identities/infrastructure/crypto/PigeonIdentityKeyProtectionGateway';
import { PigeonIdentitiesGateway } from '../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import { PigeonIdentityCommandsApi } from '../../contexts/identities/infrastructure/http/PigeonIdentityCommandsApi';
import { PigeonIdentityGateway } from '../../contexts/identities/infrastructure/http/PigeonIdentityGateway';
import { PigeonIdentityLoginApi } from '../../contexts/identities/infrastructure/http/PigeonIdentityLoginApi';
import { PigeonIdentityRegistrationApi } from '../../contexts/identities/infrastructure/http/PigeonIdentityRegistrationApi';
import { PigeonIdentitySessionApi } from '../../contexts/identities/infrastructure/http/PigeonIdentitySessionApi';
import { PigeonIdentityWorkspaceSessionApi } from '../../contexts/identities/infrastructure/http/PigeonIdentityWorkspaceSessionApi';
import { PigeonKeychainApi } from '../../contexts/identities/infrastructure/http/PigeonKeychainApi';
import { PigeonPresenceApi } from '../../contexts/identities/infrastructure/http/PigeonPresenceApi';
import { PigeonPresenceGateway } from '../../contexts/identities/infrastructure/http/PigeonPresenceGateway';
import { MessageSignaturePayloadFactory } from '../../contexts/messages/domain/MessageSignaturePayloadFactory';
import { DraftPayloadCipher } from '../../contexts/messages/infrastructure/crypto/DraftPayloadCipher';
import { hasEncryptedPayload } from '../../contexts/messages/infrastructure/crypto/hasEncryptedPayload';
import { MessageProjector } from '../../contexts/messages/infrastructure/crypto/MessageProjector';
import { yieldAfterMessageDecryptBatch } from '../../contexts/messages/infrastructure/crypto/yieldAfterMessageDecryptBatch';
import { PigeonMessageCommandsApi } from '../../contexts/messages/infrastructure/http/PigeonMessageCommandsApi';
import { PigeonMessagesApi } from '../../contexts/messages/infrastructure/http/PigeonMessagesApi';
import { PigeonMessagesGateway } from '../../contexts/messages/infrastructure/http/PigeonMessagesGateway';
import { throwIfMessageLoadAborted } from '../../contexts/messages/infrastructure/http/throwIfMessageLoadAborted';
import { PigeonNodeApi } from '../../contexts/networks/infrastructure/http/PigeonNodeApi';
import { PigeonNodeGateway } from '../../contexts/networks/infrastructure/http/PigeonNodeGateway';
import { NotificationDecision } from '../../contexts/notifications/domain/NotificationDecision';
import { NotificationId } from '../../contexts/notifications/domain/NotificationId';
import { PigeonNotificationsApi } from '../../contexts/notifications/infrastructure/http/PigeonNotificationsApi';
import { PigeonNotificationsGateway } from '../../contexts/notifications/infrastructure/http/PigeonNotificationsGateway';
import {
  PigeonPushApi,
  type PushSubscriptionPayload,
} from '../../contexts/notifications/infrastructure/http/PigeonPushApi';
import { PigeonPushGateway } from '../../contexts/notifications/infrastructure/http/PigeonPushGateway';
import { PigeonPollsApi } from '../../contexts/polls/infrastructure/http/PigeonPollsApi';
import { PigeonStickersApi } from '../../contexts/stickers/infrastructure/http/PigeonStickersApi';
import { PigeonStickersGateway } from '../../contexts/stickers/infrastructure/http/PigeonStickersGateway';
import { ApiUrlBuilder } from '../../shared/infrastructure/http/ApiUrlBuilder';
import { HttpJsonClient } from '../../shared/infrastructure/http/HttpJsonClient';
import { RequestCache } from '../../shared/infrastructure/http/RequestCache';
import { RequestSigner } from '../../shared/infrastructure/http/RequestSigner';
import { copy } from '../../shared/presentation/i18n/copy';
import { API_SERVER_URL } from '../API_SERVER_URL';

const messageDecryptBatchSize = 8;
export class PigeonApiGateway {
  private readonly communities: PigeonCommunitiesApi;

  private readonly communityInvitations: PigeonCommunityInvitationApi;

  private readonly conversationCommands: PigeonConversationCommandsApi;

  private readonly conversationsApi: PigeonConversationsApi;

  private readonly conversations: ConversationMapper;

  private readonly files: PigeonFilesGateway;

  private readonly ids: ConversationIdFactory;

  private readonly identityCommands: PigeonIdentityCommandsApi;

  private readonly identitySession: PigeonIdentitySessionApi;

  private readonly identityWorkspace: PigeonIdentityWorkspaceSessionApi;

  private readonly identityLogin: PigeonIdentityLoginApi;

  private readonly identities: PigeonIdentityGateway;

  private readonly identityKeyProtection: PigeonIdentityKeyProtectionGateway;

  private readonly keychainApi: PigeonKeychainApi;

  private readonly messagesApi: PigeonMessagesApi;

  private readonly messageCommands: PigeonMessageCommandsApi;

  private readonly messages: MessageProjector;

  private messageDecryptWorker: MessageDecryptWorkerPort | null = null;

  private readonly messageSignatures: MessageSignaturePayloadFactory;

  private readonly notifications: PigeonNotificationsGateway;

  private readonly polls: PigeonPollsApi;

  private readonly push: PigeonPushGateway;

  private readonly requestCache = new RequestCache();

  private readonly stickers: PigeonStickersGateway;

  public readonly identityRegistration: PigeonIdentityRegistrationApi;

  public readonly identityGateway: PigeonIdentitiesGateway;

  public readonly calls: PigeonCallsGateway;

  public readonly communityGateway: PigeonCommunitiesGateway;

  public readonly conversationsGateway: PigeonConversationsGateway;

  public readonly messagesGateway: PigeonMessagesGateway;

  public readonly notificationsGateway: PigeonNotificationsGateway;

  public readonly pushGateway: PigeonPushGateway;

  public readonly stickersGateway: PigeonStickersGateway;

  public readonly node: PigeonNodeGateway;

  public readonly presence: PigeonPresenceGateway;

  public constructor(
    http: HttpJsonClient = new HttpJsonClient(
      new ApiUrlBuilder(API_SERVER_URL),
    ),
    signer: RequestSigner = new RequestSigner(
      undefined,
      ApiUrlBuilder.pathPrefix(API_SERVER_URL),
    ),
    conversations: ConversationMapper = new ConversationMapper(),
    messages: MessageProjector = new MessageProjector(copy.messages),
    keychains: KeychainCipher = new KeychainCipher(),
    ids: ConversationIdFactory = new ConversationIdFactory(),
    attachmentCipher: AttachmentCipher = new AttachmentCipher(),
  ) {
    this.calls = new PigeonCallsGateway(new PigeonCallsApi(http, signer));
    this.communities = new PigeonCommunitiesApi(
      http,
      signer,
      <T>(
        key: string,
        loader: () => Promise<T>,
        options?: RequestCacheOptions,
      ) => this.requestCache.load(key, loader, options),
      new DraftPayloadCipher(),
      (key: string) => this.requestCache.invalidate(key),
    );
    this.conversations = conversations;
    this.conversationsApi = new PigeonConversationsApi(
      http,
      signer,
      this.conversations,
      this.requestCache,
    );
    this.files = new PigeonFilesGateway(
      new PigeonFilesApi(http, signer, attachmentCipher),
    );
    this.ids = ids;
    this.identities = new PigeonIdentityGateway(http);
    this.identityKeyProtection = new PigeonIdentityKeyProtectionGateway();
    this.identityCommands = new PigeonIdentityCommandsApi(
      http,
      signer,
      this.identities,
      new IdentitySignaturePayloadFactory(),
      this.identityKeyProtection,
    );
    this.identitySession = new PigeonIdentitySessionApi(
      this.identities,
      this.identityKeyProtection,
    );
    this.keychainApi = new PigeonKeychainApi(
      http,
      signer,
      keychains,
      this.requestCache,
    );
    this.identityWorkspace = new PigeonIdentityWorkspaceSessionApi({
      decryptKeychain: (session, keychain) =>
        this.keychainApi.decrypt(session, keychain),
      listConversations: async (session) =>
        await this.conversationsApi.list(session),
      loadKeychain: async (session) =>
        await this.keychainApi.loadOptional(session),
    });
    this.identityRegistration = new PigeonIdentityRegistrationApi(
      this.identityCommands,
      this.identityWorkspace,
      this.identityKeyProtection,
    );
    this.identityLogin = new PigeonIdentityLoginApi(
      this.identitySession,
      this.identityWorkspace,
    );
    this.conversationCommands = new PigeonConversationCommandsApi(
      http,
      signer,
      this.conversations,
      this.ids,
      this.identities,
      this.keychainApi,
      this.requestCache,
    );
    this.conversationsGateway = new PigeonConversationsGateway(
      this.conversationsApi,
      this.conversationCommands,
    );
    this.communityInvitations = new PigeonCommunityInvitationApi(
      http,
      signer,
      this.communities,
      this.identities,
      this.keychainApi,
    );
    this.communityGateway = new PigeonCommunitiesGateway(
      this.communities,
      this.communityInvitations,
      this.requestCache,
      this.files,
    );
    this.messageSignatures = new MessageSignaturePayloadFactory();
    this.messages = messages;
    const projection: MessageProjectionPort = {
      decrypt: async (session, conversationId, message) =>
        await this.decryptMessage(session, conversationId, message),
      decryptMany: async (session, conversationId, messageResources, signal) =>
        await this.decryptMessages(
          session,
          conversationId,
          messageResources,
          signal,
        ),
      list: (value) => this.messages.list(value),
    };
    this.messagesApi = new PigeonMessagesApi(
      http,
      signer,
      this.requestCache,
      projection,
    );
    this.messageCommands = new PigeonMessageCommandsApi(
      http,
      signer,
      this.messagesApi,
      projection,
      this.files,
      this.messageSignatures,
    );
    this.messagesGateway = new PigeonMessagesGateway(
      this.messagesApi,
      this.messageCommands,
    );
    this.node = new PigeonNodeGateway(new PigeonNodeApi(http, signer));
    this.notifications = new PigeonNotificationsGateway(
      new PigeonNotificationsApi(
        http,
        signer,
        <T>(
          key: string,
          loader: () => Promise<T>,
          options?: RequestCacheOptions,
        ) => this.requestCache.load(key, loader, options),
      ),
      (session) =>
        this.requestCache.invalidateForSession(
          '/notification-settings/',
          session,
        ),
    );
    this.push = new PigeonPushGateway(new PigeonPushApi(http, signer));
    this.presence = new PigeonPresenceGateway(
      new PigeonPresenceApi(http, signer),
      this.requestCache,
    );
    this.polls = new PigeonPollsApi(http, signer);
    this.stickers = new PigeonStickersGateway(
      new PigeonStickersApi(http, signer),
    );
    this.identityGateway = new PigeonIdentitiesGateway(
      this.identityCommands,
      this.identityLogin,
      this.identities,
      this.identityKeyProtection,
      this.keychainApi,
      this.presence,
      this.identityRegistration,
    );
    this.notificationsGateway = this.notifications;
    this.pushGateway = this.push;
    this.stickersGateway = this.stickers;
  }

  private async decryptInvitationKey(
    session: Session,
    encryptedKey: string,
  ): Promise<ConversationKeyEntry> {
    const decrypted = await session.keyPair.decrypt(
      new EncryptedPayload(encryptedKey),
    );

    return JSON.parse(decrypted.toString()) as ConversationKeyEntry;
  }

  private async decryptMessages(
    session: Session,
    conversationId: string,
    messages: MessageResource[],
    signal?: AbortSignal,
  ): Promise<ChatMessage[]> {
    const pendingMessages = messages.filter(
      (message) => message.type !== 'deleted',
    );
    const key = pendingMessages.some(hasEncryptedPayload)
      ? ConversationKeychain.entry(
          session.keychain,
          session.identity.id,
          conversationId,
        )
      : undefined;

    if (typeof Worker !== 'undefined') {
      const worker = await this.getMessageDecryptWorker();

      return await worker.decrypt(
        {
          conversationId,
          copy: copy.messages,
          currentIdentityId: session.identity.id,
          messages: pendingMessages,
          symmetricKey: key?.key,
        },
        signal,
      );
    }

    const decrypted = new Array<ChatMessage>(pendingMessages.length);

    for (
      let endIndex = pendingMessages.length;
      endIndex > 0;
      endIndex -= messageDecryptBatchSize
    ) {
      throwIfMessageLoadAborted(signal);

      const startIndex = Math.max(0, endIndex - messageDecryptBatchSize);
      const indexes = Array.from(
        { length: endIndex - startIndex },
        (_, offset) => startIndex + offset,
      );
      const batch = pendingMessages.slice(startIndex, endIndex);

      const decryptedBatch = await Promise.all(
        batch.map((message) =>
          this.projectMessageDirect(session, conversationId, message),
        ),
      );

      for (let index = 0; index < indexes.length; index += 1) {
        decrypted[indexes[index]] = decryptedBatch[index];
      }

      throwIfMessageLoadAborted(signal);

      if (startIndex > 0) {
        await yieldAfterMessageDecryptBatch();
      }
    }

    return decrypted;
  }

  private async projectMessageDirect(
    session: Session,
    conversationId: string,
    message: MessageResource,
  ): Promise<ChatMessage> {
    return await this.messages.toChatMessage(session, conversationId, message);
  }

  private async getMessageDecryptWorker(): Promise<MessageDecryptWorkerPort> {
    if (this.messageDecryptWorker) return this.messageDecryptWorker;

    const { MessageDecryptWorkerClient } =
      await import('../../contexts/messages/infrastructure/crypto/MessageDecryptWorkerClient');

    this.messageDecryptWorker = new MessageDecryptWorkerClient();

    return this.messageDecryptWorker;
  }

  public apiUrl(path: string): string {
    return new ApiUrlBuilder(API_SERVER_URL).build(path);
  }

  public async getPushVapidPublicKey(): Promise<{
    enabled: boolean;
    publicKey?: string;
  }> {
    return await this.push.getPushVapidPublicKey();
  }

  public async registerPushSubscription(
    session: Session,
    subscription: PushSubscriptionPayload,
  ): Promise<void> {
    await this.push.registerPushSubscription(session, subscription);
  }

  public async deletePushSubscription(
    session: Session,
    subscription: PushSubscriptionPayload,
  ): Promise<void> {
    await this.push.deletePushSubscription(session, subscription);
  }

  public async listCommunities(session: Session): Promise<Community[]> {
    return await this.communityGateway.listCommunities(session);
  }

  public async getCommunity(
    session: Session,
    communityId: string,
  ): Promise<Community> {
    return await this.communityGateway.getCommunity(session, communityId);
  }

  public async listCommunityModerationLogs(
    session: Session,
    communityId: string,
    input?: { beforeLogId?: string; limit?: number },
  ): Promise<CommunityModerationLogPage> {
    return await this.communityGateway.listCommunityModerationLogs(
      session,
      communityId,
      input,
    );
  }

  public async discoverCommunities(
    session: Session,
    input: { networkId?: string; query?: string },
  ): Promise<CommunityDiscoveryResource[]> {
    return await this.communityGateway.discoverCommunities(session, input);
  }

  public async createCommunity(
    session: Session,
    input: {
      autoJoinEnabled?: boolean | undefined;
      avatar?: string;
      banner?: string;
      description: string;
      discoverable?: boolean | undefined;
      name: string;
      networkId: string;
      visibility?: CommunityVisibility;
    },
  ): Promise<Community> {
    return await this.communityGateway.createCommunity(session, input);
  }

  public async updateCommunity(
    session: Session,
    communityId: string,
    input: {
      autoJoinEnabled?: boolean | undefined;
      avatar?: string;
      banner?: string;
      description?: string;
      discoverable?: boolean | undefined;
      name?: string;
    },
  ): Promise<Community> {
    return await this.communityGateway.updateCommunity(
      session,
      communityId,
      input,
    );
  }

  public async addCommunityMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<CommunityMembershipRequest> {
    return await this.communityGateway.addCommunityMember(
      session,
      communityId,
      identityId,
    );
  }

  public async banCommunityMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community> {
    return await this.communityGateway.banCommunityMember(
      session,
      communityId,
      identityId,
    );
  }

  public async unbanCommunityMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community> {
    return await this.communityGateway.unbanCommunityMember(
      session,
      communityId,
      identityId,
    );
  }

  public async kickCommunityMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community> {
    return await this.communityGateway.kickCommunityMember(
      session,
      communityId,
      identityId,
    );
  }

  public async createCommunityJoinRequest(
    session: Session,
    communityId: string,
  ): Promise<CommunityMembershipRequest> {
    return await this.communityGateway.createCommunityJoinRequest(
      session,
      communityId,
    );
  }

  public async listCommunityMembershipRequests(
    session: Session,
  ): Promise<CommunityMembershipRequest[]> {
    return await this.communityGateway.listCommunityMembershipRequests(session);
  }

  public async updateCommunityMembershipRequest(
    session: Session,
    requestId: string,
    status: Extract<CommunityMembershipRequestStatus, 'accepted' | 'declined'>,
  ): Promise<CommunityMembershipRequest> {
    return await this.communityGateway.updateCommunityMembershipRequest(
      session,
      requestId,
      status,
    );
  }

  public async leaveCommunity(
    session: Session,
    communityId: string,
  ): Promise<Community> {
    return await this.communityGateway.leaveCommunity(session, communityId);
  }

  public async listCommunityMembers(
    session: Session,
    communityId: string,
  ): Promise<string[]> {
    return await this.communityGateway.listCommunityMembers(
      session,
      communityId,
    );
  }

  public async listCommunityRoles(
    session: Session,
    communityId: string,
  ): Promise<CommunityRoleResource[]> {
    return await this.communityGateway.listCommunityRoles(session, communityId);
  }

  public async createCommunityRole(
    session: Session,
    communityId: string,
    input: { name: string; permissions: CommunityPermission[] },
  ): Promise<CommunityRoleResource> {
    return await this.communityGateway.createCommunityRole(
      session,
      communityId,
      input,
    );
  }

  public async updateCommunityRole(
    session: Session,
    communityId: string,
    roleId: string,
    input: { name: string; permissions: CommunityPermission[] },
  ): Promise<CommunityRoleResource> {
    return await this.communityGateway.updateCommunityRole(
      session,
      communityId,
      roleId,
      input,
    );
  }

  public async deleteCommunityRole(
    session: Session,
    communityId: string,
    roleId: string,
  ): Promise<void> {
    await this.communityGateway.deleteCommunityRole(
      session,
      communityId,
      roleId,
    );
  }

  public async assignCommunityMemberRoles(
    session: Session,
    communityId: string,
    identityId: string,
    roleIds: string[],
  ): Promise<Community> {
    return await this.communityGateway.assignCommunityMemberRoles(
      session,
      communityId,
      identityId,
      roleIds,
    );
  }

  public async createCommunityTextChannel(
    session: Session,
    communityId: string,
    name: string,
  ): Promise<CommunityTextChannel> {
    return await this.communityGateway.createCommunityTextChannel(
      session,
      communityId,
      name,
    );
  }

  public async createCommunityVoiceChannel(
    session: Session,
    communityId: string,
    name: string,
  ): Promise<CommunityVoiceChannel> {
    return await this.communityGateway.createCommunityVoiceChannel(
      session,
      communityId,
      name,
    );
  }

  public async listCommunityChannels(
    session: Session,
    communityId: string,
  ): Promise<CommunityChannel[]> {
    return await this.communityGateway.listCommunityChannels(
      session,
      communityId,
    );
  }

  public async renameCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
    name: string,
  ): Promise<CommunityChannel> {
    return await this.communityGateway.renameCommunityChannel(
      session,
      communityId,
      channelId,
      name,
    );
  }

  public async deleteCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<Community> {
    return await this.communityGateway.deleteCommunityChannel(
      session,
      communityId,
      channelId,
    );
  }

  public async updateCommunityChannelPermissions(
    session: Session,
    communityId: string,
    channelId: string,
    visibleRoleIds: string[],
  ): Promise<CommunityChannel> {
    return await this.communityGateway.updateCommunityChannelPermissions(
      session,
      communityId,
      channelId,
      visibleRoleIds,
    );
  }

  public async createCommunityChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    input: CommunityChannelMessageInput,
  ): Promise<MessageResource> {
    return await this.communityGateway.createCommunityChannelMessage(
      session,
      communityId,
      channelId,
      input,
    );
  }

  public async listCommunityChannelMessages(
    session: Session,
    communityId: string,
    channelId: string,
    options: { beforeMessageId?: string; limit?: number } = {},
  ): Promise<{
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }> {
    return await this.communityGateway.listCommunityChannelMessages(
      session,
      communityId,
      channelId,
      options,
    );
  }

  public async listCommunityChannelMessageThread(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    options: { limit?: number } = {},
  ): Promise<{
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }> {
    return await this.communityGateway.listCommunityChannelMessageThread(
      session,
      communityId,
      channelId,
      messageId,
      options,
    );
  }

  public async listCommunityChannelMessagePins(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<CommunityChannelMessagePinsResource> {
    return await this.communityGateway.listCommunityChannelMessagePins(
      session,
      communityId,
      channelId,
    );
  }

  public async pinCommunityChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
  ): Promise<void> {
    await this.communityGateway.pinCommunityChannelMessage(
      session,
      communityId,
      channelId,
      messageId,
    );
  }

  public async unpinCommunityChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
  ): Promise<void> {
    await this.communityGateway.unpinCommunityChannelMessage(
      session,
      communityId,
      channelId,
      messageId,
    );
  }

  public async listCommunityDrafts(
    session: Session,
  ): Promise<CommunityChannelDraft[]> {
    return await this.communityGateway.listCommunityDrafts(session);
  }

  public async saveCommunityChannelDraft(
    session: Session,
    communityId: string,
    channelId: string,
    content: string,
    updatedAt = Date.now(),
  ): Promise<CommunityChannelDraft> {
    return await this.communityGateway.saveCommunityChannelDraft(
      session,
      communityId,
      channelId,
      content,
      updatedAt,
    );
  }

  public async deleteCommunityChannelDraft(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<void> {
    await this.communityGateway.deleteCommunityChannelDraft(
      session,
      communityId,
      channelId,
    );
  }

  public async searchCommunityChannelMessages(
    session: Session,
    communityId: string,
    channelId: string,
    input: { limit?: number; query: string },
  ): Promise<{
    channelId?: string;
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }> {
    return await this.communityGateway.searchCommunityChannelMessages(
      session,
      communityId,
      channelId,
      input,
    );
  }

  public async searchCommunityMessages(
    session: Session,
    communityId: string,
    input: { limit?: number; query: string },
  ): Promise<{
    channelId?: string;
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }> {
    return await this.communityGateway.searchCommunityMessages(
      session,
      communityId,
      input,
    );
  }

  public async deleteCommunityChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
  ): Promise<void> {
    await this.communityGateway.deleteCommunityChannelMessage(
      session,
      communityId,
      channelId,
      messageId,
    );
  }

  public async editCommunityChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    input: CommunityChannelMessageEditInput,
  ): Promise<MessageResource> {
    return await this.communityGateway.editCommunityChannelMessage(
      session,
      communityId,
      channelId,
      messageId,
      input,
    );
  }

  public async addCommunityChannelMessageReaction(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.communityGateway.addCommunityChannelMessageReaction(
      session,
      communityId,
      channelId,
      messageId,
      emoji,
    );
  }

  public async removeCommunityChannelMessageReaction(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.communityGateway.removeCommunityChannelMessageReaction(
      session,
      communityId,
      channelId,
      messageId,
      emoji,
    );
  }

  public async createPoll(
    session: Session,
    input: CreatePollInput,
  ): Promise<PollResource> {
    return await this.polls.create(session, input);
  }

  public async getPoll(
    session: Session,
    pollId: string,
  ): Promise<PollResource> {
    return await this.polls.get(session, pollId);
  }

  public async votePoll(
    session: Session,
    pollId: string,
    optionIds: string[],
  ): Promise<PollResource> {
    return await this.polls.vote(session, pollId, optionIds);
  }

  public async removePollVote(
    session: Session,
    pollId: string,
  ): Promise<PollResource> {
    return await this.polls.removeVote(session, pollId);
  }

  public async closePoll(
    session: Session,
    pollId: string,
  ): Promise<PollResource> {
    return await this.polls.close(session, pollId);
  }

  public async getPublicFile(cid: string): Promise<PublicFileContent> {
    return await this.files.getPublicFile(cid);
  }

  public async getPrivateFile(cid: string): Promise<PrivateFileContent> {
    return await this.files.getPrivateFile(cid);
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
    return await this.conversationsGateway.createConversation(
      session,
      peerIdentityId,
      networkId,
    );
  }

  public async createGroupConversation(
    session: Session,
    input: { name: string; networkId: string; participantIds: string[] },
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    return await this.conversationsGateway.createGroupConversation(
      session,
      input,
    );
  }

  public async createGroupConversationInvitation(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): Promise<void> {
    await this.conversationsGateway.inviteToGroupConversation(
      session,
      conversationId,
      recipientIdentityId,
    );
  }

  public async inviteToGroupConversation(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): Promise<void> {
    await this.createGroupConversationInvitation(
      session,
      conversationId,
      recipientIdentityId,
    );
  }

  public async createCommunityInvitation(
    session: Session,
    communityId: string,
    recipientIdentityId: string,
  ): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: null | string;
  }> {
    return await this.communityGateway.createCommunityInvitation(
      session,
      communityId,
      recipientIdentityId,
    );
  }

  public async createCommunityInviteLink(
    session: Session,
    communityId: string,
    input: CommunityInviteLinkInput = {},
  ): Promise<{
    invite: CommunityInviteLinkResource;
    inviteSecret?: string;
    keyEntry?: ConversationKeyEntry;
    keychain: LocalKeychain;
    keychainExternalIdentifier: null | string;
  }> {
    return await this.communityGateway.createCommunityInviteLink(
      session,
      communityId,
      input,
    );
  }

  public async getCommunityInviteLink(
    inviteToken: string,
  ): Promise<CommunityInviteLinkResource> {
    return await this.communityGateway.getCommunityInviteLink(inviteToken);
  }

  public async acceptCommunityInviteLink(
    session: Session,
    inviteToken: string,
  ): Promise<Community> {
    return await this.communityGateway.acceptCommunityInviteLink(
      session,
      inviteToken,
    );
  }

  public async acceptCommunityInviteLinkWithKey(
    session: Session,
    inviteToken: string,
    keyEntry: ConversationKeyEntry,
  ): Promise<{
    community: Community;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    return await this.communityGateway.acceptCommunityInviteLinkWithKey(
      session,
      inviteToken,
      keyEntry,
    );
  }

  public async createIdentity(
    name: string,
    password: string,
    networks: string[],
    handle?: string,
    options: { passkeyPrfEnabled?: boolean; recoveryKey?: string } = {},
  ): Promise<IdentityResource> {
    return await this.identityGateway.createIdentity(
      name,
      password,
      networks,
      handle,
      options,
    );
  }

  public decryptKeychain(
    session: Session,
    keychain: KeychainResource,
  ): LocalKeychain {
    return this.identityGateway.decryptKeychain(session, keychain);
  }

  public async decryptMessage(
    session: Session,
    conversationId: string,
    message: MessageResource,
  ): Promise<ChatMessage> {
    const [projected] = await this.decryptMessages(session, conversationId, [
      message,
    ]);

    return projected;
  }

  public deterministicConversationId(
    leftIdentityId: string,
    rightIdentityId: string,
    networkId: string,
  ): string {
    return this.ids.create(leftIdentityId, rightIdentityId, networkId);
  }

  public async getIdentity(identityId: string): Promise<IdentityResource> {
    return await this.identityGateway.getIdentity(identityId);
  }

  public async refreshIdentity(identityId: string): Promise<IdentityResource> {
    return await this.identityGateway.refreshIdentity(identityId);
  }

  public async updateIdentityProfile(
    session: Session,
    profile: IdentityUpdateProfileInput,
    newPassword?: string,
    options: {
      currentPassword?: string;
      passkeyPrfEnabled?: boolean;
      recoveryKey?: string;
    } = {},
  ): Promise<IdentityResource> {
    return await this.identityGateway.updateIdentityProfile(
      session,
      profile,
      newPassword,
      options,
    );
  }

  public async configureLocalPasskeyUnlock(
    session: Session,
    password: string,
    enabled: boolean,
    recoveryKey?: string,
  ): Promise<void> {
    await this.identityGateway.configureLocalPasskeyUnlock(
      session,
      password,
      enabled,
      recoveryKey,
    );
  }

  public async uploadPublicFile(
    session: Session,
    file: File,
  ): Promise<PublicFileUpload> {
    return await this.files.uploadPublicFile(session, file);
  }

  public async uploadStickerAsset(
    session: Session,
    file: File,
  ): Promise<PublicFileUpload> {
    return await this.stickers.uploadAsset(session, file);
  }

  public async listStickerPacks(
    input: {
      ownerIdentityId?: string;
    } = {},
  ): Promise<StickerPackResource[]> {
    return await this.stickers.listPacks(input);
  }

  public async getStickerPack(packId: string): Promise<StickerPackResource> {
    return await this.stickers.getPack(packId);
  }

  public async getMyStickers(session: Session): Promise<MyStickersResource> {
    return await this.stickers.getMyStickers(session);
  }

  public async createStickerPack(
    session: Session,
    input: StickerPackInput,
  ): Promise<StickerPackResource> {
    return await this.stickers.createPack(session, input);
  }

  public async updateStickerPack(
    session: Session,
    packId: string,
    input: Partial<StickerPackInput>,
  ): Promise<StickerPackResource> {
    return await this.stickers.updatePack(session, packId, input);
  }

  public async addStickerToPack(
    session: Session,
    packId: string,
    input: StickerInput,
  ): Promise<StickerResource> {
    return await this.stickers.addSticker(session, packId, input);
  }

  public async updateSticker(
    session: Session,
    packId: string,
    stickerId: string,
    input: StickerInput,
  ): Promise<StickerResource> {
    return await this.stickers.updateSticker(session, packId, stickerId, input);
  }

  public async deleteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.stickers.deleteSticker(session, packId, stickerId);
  }

  public async saveStickerPack(
    session: Session,
    packId: string,
  ): Promise<void> {
    await this.stickers.savePack(session, packId);
  }

  public async unsaveStickerPack(
    session: Session,
    packId: string,
  ): Promise<void> {
    await this.stickers.unsavePack(session, packId);
  }

  public async favoriteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.stickers.favoriteSticker(session, packId, stickerId);
  }

  public async unfavoriteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.stickers.unfavoriteSticker(session, packId, stickerId);
  }

  public async markStickerUsed(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.stickers.markUsed(session, packId, stickerId);
  }

  public async uploadPrivateFile(
    session: Session,
    networkId: string,
    attachment: PendingMessageAttachment,
  ): Promise<PrivateFileUpload> {
    return await this.files.uploadPrivateFile(session, networkId, attachment);
  }

  public async downloadAttachment(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    return await this.files.downloadAttachment(attachment, onProgress);
  }

  public async listConversations(
    session: Session,
  ): Promise<ConversationResource[]> {
    return await this.conversationsGateway.listConversations(session);
  }

  public async markConversationReadUntil(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.conversationsGateway.markConversationReadUntil(
      session,
      conversationId,
      messageId,
    );
  }

  public async listNotifications(
    session: Session,
  ): Promise<NotificationResource[]> {
    return await this.notifications.listNotifications(session);
  }

  public async listNotificationSettings(
    session: Session,
  ): Promise<NotificationScopeSetting[]> {
    return await this.notifications.listNotificationSettings(session);
  }

  public async saveNotificationSetting(
    session: Session,
    setting: NotificationScopeSettingInput,
  ): Promise<NotificationScopeSetting> {
    return await this.notifications.saveNotificationSetting(session, setting);
  }

  public async resetNotificationSetting(
    session: Session,
    scope: NotificationSettingScope,
  ): Promise<void> {
    await this.notifications.resetNotificationSetting(session, scope);
  }

  public async createLinkPreview(
    session: Session,
    url: string,
  ): Promise<MessageLinkPreview> {
    return await this.messagesGateway.createLinkPreview(session, url);
  }

  public async loadMessages(
    session: Session,
    conversationId: string,
    before?: null | string,
    limitOrOptions: MessageLoadOptions | number = 30,
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> {
    return await this.messagesGateway.loadMessages(
      session,
      conversationId,
      before,
      limitOrOptions,
    );
  }

  public async loadMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<ChatMessage | null> {
    return await this.messagesGateway.loadMessage(
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
    return await this.messagesGateway.loadMessagesAround(
      session,
      conversationId,
      messageId,
    );
  }

  public async loadMessageThread(
    session: Session,
    conversationId: string,
    messageId: string,
    options: { limit?: number } = {},
  ): Promise<{ messages: ChatMessage[]; nextBeforeMessageId?: null | string }> {
    return await this.messagesGateway.loadMessageThread(
      session,
      conversationId,
      messageId,
      options,
    );
  }

  public async listMessagePins(
    session: Session,
    conversationId: string,
  ): Promise<MessagePin[]> {
    return await this.messagesGateway.listMessagePins(session, conversationId);
  }

  public async pinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.messagesGateway.pinMessage(session, conversationId, messageId);
  }

  public async unpinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.messagesGateway.unpinMessage(session, conversationId, messageId);
  }

  public async listConversationDrafts(
    session: Session,
  ): Promise<ConversationDraft[]> {
    return await this.messagesGateway.listConversationDrafts(session);
  }

  public async saveConversationDraft(
    session: Session,
    conversationId: string,
    content: string,
    updatedAt = Date.now(),
  ): Promise<ConversationDraft> {
    return await this.messagesGateway.saveConversationDraft(
      session,
      conversationId,
      content,
      updatedAt,
    );
  }

  public async deleteConversationDraft(
    session: Session,
    conversationId: string,
  ): Promise<void> {
    await this.messagesGateway.deleteConversationDraft(session, conversationId);
  }

  public async loadRemoteKeychain(session: Session): Promise<KeychainResource> {
    return await this.identityGateway.loadRemoteKeychain(session);
  }

  public async login(
    identityId: string,
    password: string,
    onProgress?: LoginIdentityProgressReporter,
    recoveryKey?: string,
  ): Promise<LoginResult> {
    return await this.identityGateway.login(
      identityId,
      password,
      onProgress,
      recoveryKey,
    );
  }

  public async restoreRememberedSession(
    identityId: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    return await this.identityGateway.restoreRememberedSession(
      identityId,
      onProgress,
    );
  }

  public async refreshSession(session: Session): Promise<LoginResult> {
    return await this.identityGateway.refreshSession(session);
  }

  public async publishKeychain(
    session: Session,
    nextKeychain: LocalKeychain,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> {
    return await this.identityGateway.publishKeychain(session, nextKeychain);
  }

  public async register(
    name: string,
    password: string,
    networks: string[],
    handle?: string,
    options: { passkeyPrfEnabled?: boolean; recoveryKey?: string } = {},
  ): Promise<LoginResult> {
    return await this.identityGateway.register(
      ProfileName.fromString(name),
      password,
      IdentityNetworkMemberships.fromPrimitives(networks),
      handle ? ProfileHandle.fromString(handle) : undefined,
      options,
    );
  }

  public async sendMessage(
    session: Session,
    conversationId: string,
    content: string,
    options: SendMessageOptions = {},
  ): Promise<ChatMessage> {
    return await this.messagesGateway.sendMessage(
      session,
      conversationId,
      content,
      options,
    );
  }

  public async editMessage(
    session: Session,
    conversationId: string,
    messageId: string,
    content: string,
    options: EditMessageOptions = {},
  ): Promise<ChatMessage> {
    return await this.messagesGateway.editMessage(
      session,
      conversationId,
      messageId,
      content,
      options,
    );
  }

  public async deleteMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.messagesGateway.deleteMessage(
      session,
      conversationId,
      messageId,
    );
  }

  public async addMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.messagesGateway.addMessageReaction(
      session,
      conversationId,
      messageId,
      emoji,
    );
  }

  public async removeMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.messagesGateway.removeMessageReaction(
      session,
      conversationId,
      messageId,
      emoji,
    );
  }

  public async updateNotification(
    session: Session,
    notificationId: NotificationId,
    decision: NotificationDecision,
  ): Promise<NotificationResource> {
    return await this.notifications.updateNotification(
      session,
      notificationId,
      decision,
    );
  }

  public async acceptConversationInvitation(
    session: Session,
    notification: NotificationResource,
  ): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
    notification: NotificationResource;
  }> {
    if (notification.type === 'missed_call') {
      throw new Error('Missed call notifications cannot be accepted.');
    }

    const encryptedKey =
      notification.type === 'community_invitation'
        ? notification.payload.encryptedCommunityKey
        : notification.payload.encryptedConversationKey;
    const keyEntry = await this.decryptInvitationKey(session, encryptedKey);
    const published = await this.publishKeychain(
      session,
      ConversationKeychain.withEntry(session.keychain, keyEntry),
    );
    const updated = await this.updateNotification(
      {
        ...session,
        keychain: published.keychain,
        keychainExternalIdentifier: published.keychainExternalIdentifier,
      },
      NotificationId.fromString(notification.id),
      NotificationDecision.accepted(),
    );

    return { ...published, notification: updated };
  }

  public async publishMessageAttachments(
    session: Session,
    attachments: File[],
    onProgress?: (progress: AttachmentProgress) => void,
    options?: AttachmentUploadOptions,
  ): Promise<MessageAttachment[]> {
    return await this.files.publishMessageAttachments(
      session,
      attachments,
      onProgress,
      options,
    );
  }
}
