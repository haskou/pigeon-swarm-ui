import { EncryptedPayload, KeyPair, SymmetricKey } from '@haskou/value-objects';

import type { CommunityChannelMessageEditInput } from '../../contexts/communities/infrastructure/http/CommunityChannelMessageEditInput';
import type { CommunityChannelMessageInput } from '../../contexts/communities/infrastructure/http/CommunityChannelMessageInput';
import type { CommunityInviteLinkInput } from '../../contexts/communities/infrastructure/http/CommunityInviteLinkInput';
import type { LoginIdentityProgressReporter } from '../../contexts/identities/application/ports/LoginIdentityProgressReporter';
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
import { PigeonCommunityInvitationApi } from '../../contexts/communities/infrastructure/http/PigeonCommunityInvitationApi';
import { ConversationIdFactory } from '../../contexts/conversations/domain/ConversationIdFactory';
import { ConversationKeychain } from '../../contexts/conversations/domain/ConversationKeychain';
import { ConversationMapper } from '../../contexts/conversations/infrastructure/http/ConversationMapper';
import { PigeonConversationCommandsApi } from '../../contexts/conversations/infrastructure/http/PigeonConversationCommandsApi';
import { PigeonConversationsApi } from '../../contexts/conversations/infrastructure/http/PigeonConversationsApi';
import { IdentitySignaturePayloadFactory } from '../../contexts/identities/domain/IdentitySignaturePayloadFactory';
import { KeychainCipher } from '../../contexts/identities/infrastructure/crypto/KeychainCipher';
import { PigeonIdentityKeyProtectionGateway } from '../../contexts/identities/infrastructure/crypto/PigeonIdentityKeyProtectionGateway';
import { PigeonIdentityCommandsApi } from '../../contexts/identities/infrastructure/http/PigeonIdentityCommandsApi';
import { PigeonIdentityGateway } from '../../contexts/identities/infrastructure/http/PigeonIdentityGateway';
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

const defaultKeychain: LocalKeychain = {
  conversations: {},
  version: 0,
};

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

  public readonly calls: PigeonCallsGateway;

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
        await this.listConversations(session),
      loadKeychain: async (session) =>
        await this.keychainApi.loadOptional(session),
    });
    this.conversationCommands = new PigeonConversationCommandsApi(
      http,
      signer,
      this.conversations,
      this.ids,
      this.identities,
      this.keychainApi,
      this.requestCache,
    );
    this.communityInvitations = new PigeonCommunityInvitationApi(
      http,
      signer,
      this.communities,
      this.identities,
      this.keychainApi,
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
    this.presence = new PigeonPresenceGateway(
      new PigeonPresenceApi(http, signer),
      this.requestCache,
    );
    this.polls = new PigeonPollsApi(http, signer);
    this.push = new PigeonPushGateway(new PigeonPushApi(http, signer));
    this.stickers = new PigeonStickersGateway(
      new PigeonStickersApi(http, signer),
    );
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

  private invalidateCommunityChannelPinsCache(
    session: Session,
    communityId: string,
    channelId: string,
  ): void {
    this.requestCache.invalidateForSession(
      `/communities/${encodeURIComponent(
        communityId,
      )}/channels/${encodeURIComponent(channelId)}/pins`,
      session,
    );
  }

  private withConversationKey(
    keychain: LocalKeychain,
    keyEntry: ConversationKeyEntry,
  ): LocalKeychain {
    return {
      conversations: {
        ...keychain.conversations,
        [keyEntry.conversationId]: keyEntry,
      },
      version: keychain.version + 1,
    };
  }

  private decryptIdentityPayload(
    session: Session,
    encryptedPayload: string,
  ): Buffer {
    const payload = new EncryptedPayload(encryptedPayload);

    return session.keyPair.decrypt(payload);
  }

  private async createIdentityMaterial(
    name: string,
    password: string,
    networks: string[],
    handle?: string,
    options: { passkeyPrfEnabled?: boolean; recoveryKey?: string } = {},
  ): Promise<{
    identity: IdentityResource;
    keyPair: KeyPair;
    masterKey: SymmetricKey;
  }> {
    return await this.identityCommands.create(
      name,
      password,
      networks,
      handle,
      options,
    );
  }

  private async hydrateLoginSession(
    session: Session,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    return await this.identityWorkspace.hydrate(session, onProgress);
  }

  public apiUrl(path: string): string {
    return new ApiUrlBuilder(API_SERVER_URL).build(path);
  }

  public async getPushVapidPublicKey(): Promise<{
    enabled: boolean;
    publicKey?: string;
  }> {
    return await this.push.getVapidPublicKey();
  }

  public async registerPushSubscription(
    session: Session,
    subscription: PushSubscriptionPayload,
  ): Promise<void> {
    await this.push.registerSubscription(session, subscription);
  }

  public async deletePushSubscription(
    session: Session,
    subscription: PushSubscriptionPayload,
  ): Promise<void> {
    await this.push.deleteSubscription(session, subscription);
  }

  public async listCommunities(session: Session): Promise<Community[]> {
    return await this.communities.list(session);
  }

  public async getCommunity(
    session: Session,
    communityId: string,
  ): Promise<Community> {
    return await this.communities.get(session, communityId);
  }

  public async listCommunityModerationLogs(
    session: Session,
    communityId: string,
    input?: { beforeLogId?: string; limit?: number },
  ): Promise<CommunityModerationLogPage> {
    return await this.communities.listModerationLogs(
      session,
      communityId,
      input,
    );
  }

  public async discoverCommunities(
    session: Session,
    input: { networkId?: string; query?: string },
  ): Promise<CommunityDiscoveryResource[]> {
    return await this.communities.discover(session, input);
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
    return await this.communities.create(session, input);
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
    return await this.communities.update(session, communityId, input);
  }

  public async addCommunityMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<CommunityMembershipRequest> {
    return await this.communities.inviteMember(
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
    return await this.communities.banMember(session, communityId, identityId);
  }

  public async unbanCommunityMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community> {
    return await this.communities.unbanMember(session, communityId, identityId);
  }

  public async kickCommunityMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community> {
    return await this.communities.kickMember(session, communityId, identityId);
  }

  public async createCommunityJoinRequest(
    session: Session,
    communityId: string,
  ): Promise<CommunityMembershipRequest> {
    const request = await this.communities.createJoinRequest(
      session,
      communityId,
    );

    this.requestCache.invalidateForSession(
      '/communities/membership-requests',
      session,
    );

    return request;
  }

  public async listCommunityMembershipRequests(
    session: Session,
  ): Promise<CommunityMembershipRequest[]> {
    return await this.communities.listMembershipRequests(session);
  }

  public async updateCommunityMembershipRequest(
    session: Session,
    requestId: string,
    status: Extract<CommunityMembershipRequestStatus, 'accepted' | 'declined'>,
  ): Promise<CommunityMembershipRequest> {
    const request = await this.communities.updateMembershipRequest(
      session,
      requestId,
      status,
    );
    this.requestCache.invalidateForSession(
      '/communities/membership-requests',
      session,
    );

    if (status === 'accepted' && request.type === 'request') {
      const hasCommunityKey = Boolean(
        session.keychain.conversations[request.communityId],
      );

      if (!hasCommunityKey) {
        const community = await this.getCommunity(session, request.communityId);

        if (community.visibility === 'public') return request;
      }

      await this.communityInvitations.notifyMember(
        session,
        request.communityId,
        request.identityId,
      );
    }

    return request;
  }

  public async leaveCommunity(
    session: Session,
    communityId: string,
  ): Promise<Community> {
    return await this.communities.leave(session, communityId);
  }

  public async listCommunityMembers(
    session: Session,
    communityId: string,
  ): Promise<string[]> {
    return await this.communities.listMembers(session, communityId);
  }

  public async listCommunityRoles(
    session: Session,
    communityId: string,
  ): Promise<CommunityRoleResource[]> {
    return await this.communities.listRoles(session, communityId);
  }

  public async createCommunityRole(
    session: Session,
    communityId: string,
    input: { name: string; permissions: CommunityPermission[] },
  ): Promise<CommunityRoleResource> {
    return await this.communities.createRole(session, communityId, input);
  }

  public async updateCommunityRole(
    session: Session,
    communityId: string,
    roleId: string,
    input: { name: string; permissions: CommunityPermission[] },
  ): Promise<CommunityRoleResource> {
    return await this.communities.updateRole(
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
    await this.communities.deleteRole(session, communityId, roleId);
  }

  public async assignCommunityMemberRoles(
    session: Session,
    communityId: string,
    identityId: string,
    roleIds: string[],
  ): Promise<Community> {
    return await this.communities.assignMemberRoles(
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
    return await this.communities.createTextChannel(session, communityId, name);
  }

  public async createCommunityVoiceChannel(
    session: Session,
    communityId: string,
    name: string,
  ): Promise<CommunityVoiceChannel> {
    return await this.communities.createVoiceChannel(
      session,
      communityId,
      name,
    );
  }

  public async listCommunityChannels(
    session: Session,
    communityId: string,
  ): Promise<CommunityChannel[]> {
    return await this.communities.listChannels(session, communityId);
  }

  public async renameCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
    name: string,
  ): Promise<CommunityChannel> {
    return await this.communities.renameChannel(
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
    return await this.communities.deleteChannel(
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
    return await this.communities.updateChannelPermissions(
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
    return await this.communities.createChannelMessage(
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
    return await this.communities.listChannelMessages(
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
    return await this.communities.listChannelMessageThread(
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
    return await this.communities.listChannelMessagePins(
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
    await this.communities.pinChannelMessage(
      session,
      communityId,
      channelId,
      messageId,
    );
    this.invalidateCommunityChannelPinsCache(session, communityId, channelId);
  }

  public async unpinCommunityChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
  ): Promise<void> {
    await this.communities.unpinChannelMessage(
      session,
      communityId,
      channelId,
      messageId,
    );
    this.invalidateCommunityChannelPinsCache(session, communityId, channelId);
  }

  public async listCommunityDrafts(
    session: Session,
  ): Promise<CommunityChannelDraft[]> {
    return await this.communities.listDrafts(session);
  }

  public async saveCommunityChannelDraft(
    session: Session,
    communityId: string,
    channelId: string,
    content: string,
    updatedAt = Date.now(),
  ): Promise<CommunityChannelDraft> {
    const draft = await this.communities.saveChannelDraft(
      session,
      communityId,
      channelId,
      content,
      updatedAt,
    );

    this.requestCache.invalidateForSession('/communities/me/drafts', session);

    return draft;
  }

  public async deleteCommunityChannelDraft(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<void> {
    await this.communities.deleteChannelDraft(session, communityId, channelId);
    this.requestCache.invalidateForSession('/communities/me/drafts', session);
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
    return await this.communities.searchChannelMessages(
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
    return await this.communities.searchCommunityMessages(
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
    await this.communities.deleteChannelMessage(
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
    return await this.communities.editChannelMessage(
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
    await this.communities.addChannelMessageReaction(
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
    await this.communities.removeChannelMessageReaction(
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
    return await this.conversationCommands.create(
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
    return await this.conversationCommands.createGroup(session, input);
  }

  public async createGroupConversationInvitation(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): Promise<void> {
    await this.conversationCommands.invite(
      session,
      conversationId,
      recipientIdentityId,
      'group_conversation_invitation',
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
    return await this.communityInvitations.create(
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
    return await this.communityInvitations.createInviteLink(
      session,
      communityId,
      input,
    );
  }

  public async getCommunityInviteLink(
    inviteToken: string,
  ): Promise<CommunityInviteLinkResource> {
    return await this.communityInvitations.getInviteLink(inviteToken);
  }

  public async acceptCommunityInviteLink(
    session: Session,
    inviteToken: string,
  ): Promise<Community> {
    return await this.communityInvitations.acceptInviteLink(
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
    return await this.communityInvitations.acceptInviteLinkWithKey(
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
    const { identity } = await this.createIdentityMaterial(
      name,
      password,
      networks,
      handle,
      options,
    );

    return identity;
  }

  public decryptKeychain(
    session: Session,
    keychain: KeychainResource,
  ): LocalKeychain {
    return this.keychainApi.decrypt(session, keychain);
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
    return await this.identities.get(identityId);
  }

  public async refreshIdentity(identityId: string): Promise<IdentityResource> {
    return await this.identities.refresh(identityId);
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
    return await this.identityCommands.updateProfile(
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
    await this.identityKeyProtection.configureLocalPasskeyUnlock(
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
    return await this.conversationsApi.list(session);
  }

  public async markConversationReadUntil(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.conversationsApi.markReadUntil(
      session,
      conversationId,
      messageId,
    );
  }

  public async listNotifications(
    session: Session,
  ): Promise<NotificationResource[]> {
    return await this.notifications.list(session);
  }

  public async listNotificationSettings(
    session: Session,
  ): Promise<NotificationScopeSetting[]> {
    return await this.notifications.listSettings(session);
  }

  public async saveNotificationSetting(
    session: Session,
    setting: NotificationScopeSettingInput,
  ): Promise<NotificationScopeSetting> {
    return await this.notifications.saveSetting(session, setting);
  }

  public async resetNotificationSetting(
    session: Session,
    scope: NotificationSettingScope,
  ): Promise<void> {
    await this.notifications.resetSetting(session, scope);
  }

  public async createLinkPreview(
    session: Session,
    url: string,
  ): Promise<MessageLinkPreview> {
    return await this.messagesApi.createLinkPreview(session, url);
  }

  public async loadMessages(
    session: Session,
    conversationId: string,
    before?: null | string,
    limitOrOptions: MessageLoadOptions | number = 30,
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> {
    return await this.messagesApi.loadMessages(
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
    return await this.messagesApi.loadMessage(
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
    return await this.messagesApi.loadMessagesAround(
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
    return await this.messagesApi.loadMessageThread(
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
    return await this.messagesApi.listMessagePins(session, conversationId);
  }

  public async pinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.messagesApi.pinMessage(session, conversationId, messageId);
  }

  public async unpinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.messagesApi.unpinMessage(session, conversationId, messageId);
  }

  public async listConversationDrafts(
    session: Session,
  ): Promise<ConversationDraft[]> {
    return await this.messagesApi.listConversationDrafts(session);
  }

  public async saveConversationDraft(
    session: Session,
    conversationId: string,
    content: string,
    updatedAt = Date.now(),
  ): Promise<ConversationDraft> {
    return await this.messagesApi.saveConversationDraft(
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
    await this.messagesApi.deleteConversationDraft(session, conversationId);
  }

  public async loadRemoteKeychain(session: Session): Promise<KeychainResource> {
    return await this.keychainApi.load(session);
  }

  public async login(
    identityId: string,
    password: string,
    onProgress?: LoginIdentityProgressReporter,
    recoveryKey?: string,
  ): Promise<LoginResult> {
    const session = await this.identitySession.unlock(
      identityId,
      password,
      onProgress,
      recoveryKey,
    );

    return await this.hydrateLoginSession(session, onProgress);
  }

  public async restoreRememberedSession(
    identityId: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    const session = await this.identitySession.restoreRemembered(
      identityId,
      onProgress,
    );

    return await this.identityWorkspace.hydrate(session, onProgress);
  }

  public async refreshSession(session: Session): Promise<LoginResult> {
    return await this.identityWorkspace.refresh(session);
  }

  public async publishKeychain(
    session: Session,
    nextKeychain: LocalKeychain,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> {
    return await this.keychainApi.publish(session, nextKeychain);
  }

  public async register(
    name: string,
    password: string,
    networks: string[],
    handle?: string,
    options: { passkeyPrfEnabled?: boolean; recoveryKey?: string } = {},
  ): Promise<LoginResult> {
    const { identity, keyPair, masterKey } = await this.createIdentityMaterial(
      name,
      password,
      networks,
      handle,
      options,
    );
    const result = await this.hydrateLoginSession({
      identity,
      keychain: defaultKeychain,
      keyPair,
      masterKey,
    });

    if (
      options.passkeyPrfEnabled &&
      !result.session.identity.masterKeyDerivation.passkeyPrf
    ) {
      await this.identityKeyProtection
        .saveLocalPasskeyMasterKeyUnlock({
          displayName: name,
          identityId: result.session.identity.id,
          masterKey: result.session.masterKey,
          password,
        })
        .catch(() => undefined);
    }

    return result;
  }

  public async sendMessage(
    session: Session,
    conversationId: string,
    content: string,
    options: SendMessageOptions = {},
  ): Promise<ChatMessage> {
    return await this.messageCommands.send(
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
    return await this.messageCommands.edit(
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
    await this.messageCommands.delete(session, conversationId, messageId);
  }

  public async addMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.messagesApi.addMessageReaction(
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
    await this.messagesApi.removeMessageReaction(
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
    return await this.notifications.update(session, notificationId, decision);
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
    const decrypted = await this.decryptIdentityPayload(session, encryptedKey);
    const keyEntry = JSON.parse(decrypted.toString()) as ConversationKeyEntry;
    const nextKeychain = this.withConversationKey(session.keychain, keyEntry);
    const published = await this.publishKeychain(session, nextKeychain);
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
