import {
  EncryptedPayload,
  EncryptedKeyPair,
  EncryptedPrivateKey,
  KeyPair,
  PublicKey,
  StringValueObject,
  UUID,
} from '@haskou/value-objects';

import type {
  CallIceServerConfig,
  CallResource,
  CallSignalPayload,
} from '../../modules/calls/domain/callSession.types';
import type { IdentityUpdateProfileInput } from '../../modules/identities/domain/identitySignaturePayloadFactory';
import type { NodeNetwork } from '../../modules/networks/application/list-node-networks/NodeNetwork';
import type { Peer } from '../../modules/networks/application/list-peers/ListPeers';
import type {
  ChatMessage,
  Community,
  CommunityChannel,
  CommunityDiscoveryResource,
  CommunityInviteLinkResource,
  CommunityMessageMention,
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
  ConversationDraftsResource,
  ConversationKeyEntry,
  ConversationMessagePinsResource,
  ConversationResource,
  CreatePollInput,
  EditMessageOptions,
  AttachmentProgress,
  AttachmentUploadOptions,
  IdentityResource,
  IdentityPresence,
  IpfsReplicationStatus,
  KeychainResource,
  LocalKeychain,
  LoginResult,
  MessageAttachment,
  MessageLinkPreview,
  MessagePin,
  MessageReplyPreview,
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
  SelectablePresenceStatus,
  StickerInput,
  StickerMessageReference,
  StickerPackInput,
  StickerPackResource,
  StickerResource,
} from '../../shared/domain/pigeonResources.types';

import { AttachmentExternalIdentifiers } from '../../modules/attachments/domain/AttachmentExternalIdentifiers';
import { AttachmentCipher } from '../../modules/attachments/infrastructure/crypto/AttachmentCipher';
import { PigeonFilesApi } from '../../modules/attachments/infrastructure/http/PigeonFilesApi';
import { PigeonCallsApi } from '../../modules/calls/infrastructure/http/PigeonCallsApi';
import {
  encryptCommunityInviteKey,
  type EncryptedCommunityKey,
} from '../../modules/communities/infrastructure/crypto/communityInviteKeyEnvelope';
import { PigeonCommunitiesApi } from '../../modules/communities/infrastructure/http/PigeonCommunitiesApi';
import { ConversationIdFactory } from '../../modules/conversations/domain/ConversationIdFactory';
import { ConversationKeychain } from '../../modules/conversations/domain/ConversationKeychain';
import { ConversationMapper } from '../../modules/conversations/infrastructure/http/ConversationMapper';
import { IdentitySignaturePayloadFactory } from '../../modules/identities/domain/identitySignaturePayloadFactory';
import { IdentityId } from '../../modules/identities/domain/value-objects/IdentityId';
import { KeychainCipher } from '../../modules/identities/infrastructure/crypto/KeychainCipher';
import { PigeonPresenceApi } from '../../modules/identities/infrastructure/http/PigeonPresenceApi';
import { MessageLinkPreviews } from '../../modules/messages/domain/MessageLinkPreviews';
import { MessageProjector } from '../../modules/messages/domain/messageProjector';
import { MessageSignaturePayloadFactory } from '../../modules/messages/domain/MessageSignaturePayloadFactory';
import { DraftPayloadCipher } from '../../modules/messages/infrastructure/crypto/DraftPayloadCipher';
import { PigeonLinkPreviewsApi } from '../../modules/messages/infrastructure/http/PigeonLinkPreviewsApi';
import { PigeonNodeApi } from '../../modules/networks/infrastructure/http/PigeonNodeApi';
import { NotificationDecision } from '../../modules/notifications/domain/notificationDecision';
import { NotificationId } from '../../modules/notifications/domain/NotificationId';
import { PigeonNotificationsApi } from '../../modules/notifications/infrastructure/http/PigeonNotificationsApi';
import {
  PigeonPushApi,
  type PushSubscriptionPayload,
} from '../../modules/notifications/infrastructure/http/pigeonPushApi';
import { PigeonPollsApi } from '../../modules/polls/infrastructure/http/PigeonPollsApi';
import { PigeonStickersApi } from '../../modules/stickers/infrastructure/http/PigeonStickersApi';
import { ApiUrlBuilder } from '../../shared/infrastructure/http/ApiUrlBuilder';
import { HttpJsonClient } from '../../shared/infrastructure/http/HttpJsonClient';
import { HttpJsonError } from '../../shared/infrastructure/http/HttpJsonError';
import { RequestSigner } from '../../shared/infrastructure/http/RequestSigner';
import { copy } from '../../shared/presentation/i18n/copy';
import { API_SERVER_URL } from '../API_SERVER_URL';
import { PigeonCallsGateway } from './gateways/PigeonCallsGateway';
import { PigeonFilesGateway } from './gateways/PigeonFilesGateway';
import { PigeonStickersGateway } from './gateways/PigeonStickersGateway';

const defaultKeychain: LocalKeychain = {
  conversations: {},
  version: 0,
};

const messageDecryptBatchSize = 8;
const identityCacheTtlMs = 2 * 60 * 1000;
const startupReadCacheTtlMs = 1500;

type MessageLoadOptions = {
  limit?: number;
  signal?: AbortSignal;
};

type CachedRequestOptions = {
  ttlMs?: number;
};

type CachedRequestEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
  settled: boolean;
};

type CachedIdentity = {
  expiresAt: number;
  identity: IdentityResource;
};

type CommunityChannelMessagePayloadInput =
  | {
      encryptedPayload: string;
      plaintextPayload?: never;
    }
  | {
      encryptedPayload?: never;
      plaintextPayload: string;
    };

type CommunityChannelMessageInput = CommunityChannelMessagePayloadInput & {
  attachmentExternalIdentifiers?: string[];
  id?: string;
  mentions?: CommunityMessageMention[];
  timestamp?: number;
};

type CommunityChannelMessageEditInput = CommunityChannelMessagePayloadInput & {
  attachmentExternalIdentifiers?: string[];
  mentions?: CommunityMessageMention[];
  timestamp?: number;
};

type CommunityInviteLinkInput = {
  expiresAt?: number;
  maxUses?: number;
};

type CommunityInviteLinkBody = CommunityInviteLinkInput & {
  encryptedCommunityKey?: EncryptedCommunityKey;
};

type PublishedCommunityKey = {
  keyEntry: ConversationKeyEntry;
  keychain: LocalKeychain;
  keychainExternalIdentifier: string;
};

type MessageDecryptWorker = {
  decrypt(
    request: {
      conversationId: string;
      copy: {
        decryptFailed: string;
        missingKey: string;
      };
      currentIdentityId: string;
      messages: MessageResource[];
      privateKey?: string;
    },
    signal?: AbortSignal,
  ): Promise<ChatMessage[]>;
};

type EncryptMessagePayloadInput = {
  content: string;
  conversationId: string;
  eventType?:
    | 'MessageEdited'
    | 'MessageSent'
    | 'StickerMessageSent'
    | 'ThreadMessageSent'
    | 'ThreadStickerMessageSent';
  key: ConversationKeyEntry;
  linkPreview?: MessageLinkPreview;
  messageAttachments: MessageAttachment[];
  replyPreview?: MessageReplyPreview;
  session: Session;
  sticker?: StickerMessageReference;
  threadRootMessageId?: string;
  timestamp: number;
};

function throwIfMessageLoadAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;

  const error = new Error('Message load aborted');

  error.name = 'AbortError';
  throw error;
}

function hasEncryptedPayload(message: MessageResource): boolean {
  return Boolean(message.encryptedPayload ?? message.payload);
}

async function yieldAfterMessageDecryptBatch(): Promise<void> {
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function communityInviteLinkBody(
  input: CommunityInviteLinkInput,
  encryptedCommunityKey?: EncryptedCommunityKey,
): CommunityInviteLinkBody {
  return {
    ...(encryptedCommunityKey ? { encryptedCommunityKey } : {}),
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
  };
}

type ConversationInvitationType =
  | 'conversation_invitation'
  | 'group_conversation_invitation';

export class PigeonApiGateway {
  private readonly calls: PigeonCallsGateway;

  private readonly communities: PigeonCommunitiesApi;

  private readonly conversations: ConversationMapper;

  private readonly draftPayloads: DraftPayloadCipher;

  private readonly files: PigeonFilesGateway;

  private readonly http: HttpJsonClient;

  private readonly ids: ConversationIdFactory;

  private readonly identitySignatures: IdentitySignaturePayloadFactory;

  private readonly keychains: KeychainCipher;

  private readonly linkPreviews: PigeonLinkPreviewsApi;

  private readonly messages: MessageProjector;

  private messageDecryptWorker: MessageDecryptWorker | null = null;

  private readonly messageSignatures: MessageSignaturePayloadFactory;

  private readonly node: PigeonNodeApi;

  private readonly notifications: PigeonNotificationsApi;

  private readonly presence: PigeonPresenceApi;

  private readonly polls: PigeonPollsApi;

  private readonly push: PigeonPushApi;

  private readonly requestCache = new Map<
    string,
    CachedRequestEntry<unknown>
  >();

  private readonly identityCache = new Map<string, CachedIdentity>();

  private readonly signer: RequestSigner;

  private readonly stickers: PigeonStickersGateway;

  public constructor(
    http: HttpJsonClient = new HttpJsonClient(
      new ApiUrlBuilder(API_SERVER_URL),
    ),
    signer: RequestSigner = new RequestSigner(),
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
        options?: CachedRequestOptions,
      ) => this.cachedRequest(key, loader, options),
      new DraftPayloadCipher(),
    );
    this.conversations = conversations;
    this.draftPayloads = new DraftPayloadCipher();
    this.files = new PigeonFilesGateway(
      new PigeonFilesApi(http, signer, attachmentCipher),
    );
    this.http = http;
    this.ids = ids;
    this.identitySignatures = new IdentitySignaturePayloadFactory();
    this.keychains = keychains;
    this.linkPreviews = new PigeonLinkPreviewsApi(http, signer);
    this.messageSignatures = new MessageSignaturePayloadFactory();
    this.messages = messages;
    this.node = new PigeonNodeApi(http, signer);
    this.notifications = new PigeonNotificationsApi(
      http,
      signer,
      <T>(
        key: string,
        loader: () => Promise<T>,
        options?: CachedRequestOptions,
      ) => this.cachedRequest(key, loader, options),
    );
    this.presence = new PigeonPresenceApi(http, signer);
    this.polls = new PigeonPollsApi(http, signer);
    this.push = new PigeonPushApi(http, signer);
    this.signer = signer;
    this.stickers = new PigeonStickersGateway(
      new PigeonStickersApi(http, signer),
    );
  }

  public apiUrl(path: string): string {
    return new ApiUrlBuilder(API_SERVER_URL).build(path);
  }

  public async getNodeInfo(): Promise<{ id: string; owner: string | null }> {
    return await this.node.getInfo();
  }

  public async claimNode(session: Session): Promise<void> {
    await this.node.claim(session);
  }

  public async getNodeNetworks(
    session?: Session,
  ): Promise<{ id: string; key?: null | string; name: string }[]> {
    return await this.node.getNetworks(session);
  }

  public async getPeers(): Promise<Peer[]> {
    return await this.node.getPeers();
  }

  public async getIpfsReplicationStatus(
    session: Session,
  ): Promise<IpfsReplicationStatus> {
    return await this.node.getIpfsReplicationStatus(session);
  }

  public async getPresence(
    session: Session,
    identityId: string,
  ): Promise<IdentityPresence> {
    return await this.presence.get(session, identityId);
  }

  public async getPresences(
    session: Session,
    identityIds: string[],
  ): Promise<IdentityPresence[]> {
    const uniqueIdentityIds = [...new Set(identityIds.filter(Boolean))].sort();

    return await this.cachedRequest(
      `GET /presence/ ${session.identity.id} ${uniqueIdentityIds.join('\u0000')}`,
      () => this.presence.getMany(session, uniqueIdentityIds),
      { ttlMs: startupReadCacheTtlMs },
    );
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

  public async updatePresence(
    session: Session,
    input: { status: SelectablePresenceStatus },
  ): Promise<IdentityPresence> {
    return await this.presence.update(session, input);
  }

  public async listCalls(session: Session): Promise<CallResource[]> {
    return await this.cachedRequest(
      this.sessionCacheKey('GET', '/calls/', session),
      async () => await this.calls.list(session),
      { ttlMs: startupReadCacheTtlMs },
    );
  }

  public async getCall(
    session: Session,
    callId: string,
  ): Promise<CallResource> {
    return await this.calls.get(session, callId);
  }

  public async getCallIceServers(
    session: Session,
  ): Promise<CallIceServerConfig> {
    return await this.calls.getIceServers(session);
  }

  public async startConversationCall(
    session: Session,
    conversationId: string,
  ): Promise<CallResource> {
    const call = await this.calls.startConversation(session, conversationId);

    this.invalidateSessionCacheKey('/calls/', session);

    return call;
  }

  public async startCommunityChannelCall(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<CallResource> {
    const call = await this.calls.startCommunityChannel(
      session,
      communityId,
      channelId,
    );

    this.invalidateSessionCacheKey('/calls/', session);

    return call;
  }

  public async joinCall(
    session: Session,
    callId: string,
  ): Promise<CallResource> {
    const call = await this.calls.join(session, callId);

    this.invalidateSessionCacheKey('/calls/', session);

    return call;
  }

  public async leaveCall(session: Session, callId: string): Promise<void> {
    await this.calls.leave(session, callId);
    this.invalidateSessionCacheKey('/calls/', session);
  }

  public async heartbeatCallParticipant(
    session: Session,
    callId: string,
  ): Promise<void> {
    await this.calls.heartbeat(session, callId);
  }

  public async endCall(session: Session, callId: string): Promise<void> {
    await this.calls.end(session, callId);
    this.invalidateSessionCacheKey('/calls/', session);
  }

  public async sendCallSignal(
    session: Session,
    callId: string,
    signal: CallSignalPayload,
  ): Promise<void> {
    await this.calls.sendSignal(session, callId, signal);
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

    this.invalidateSessionCacheKey('/communities/membership-requests', session);

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
    this.invalidateSessionCacheKey('/communities/membership-requests', session);

    if (status === 'accepted' && request.type === 'request') {
      const hasCommunityKey = Boolean(
        session.keychain.conversations[request.communityId],
      );

      if (!hasCommunityKey) {
        const community = await this.getCommunity(session, request.communityId);

        if (community.visibility === 'public') return request;
      }

      await this.createCommunityInvitationNotification(
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

    this.invalidateSessionCacheKey('/communities/me/drafts', session);

    return draft;
  }

  public async deleteCommunityChannelDraft(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<void> {
    await this.communities.deleteChannelDraft(session, communityId, channelId);
    this.invalidateSessionCacheKey('/communities/me/drafts', session);
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
    const peerIdentity = await this.getIdentity(peerIdentityId.trim());
    const keyEntry = await this.createConversationKeyEntry(
      session.identity.id,
      peerIdentity.id,
      networkId,
    );
    const published = await this.publishKeychain(
      session,
      this.withConversationKey(session.keychain, keyEntry),
    );
    const conversation = await this.postConversation(
      session,
      peerIdentity.id,
      published,
      networkId,
    );
    const serverKeyEntry = { ...keyEntry, conversationId: conversation.id };

    await this.createConversationInvitation(
      session,
      peerIdentity,
      serverKeyEntry,
    );

    return {
      conversation,
      keychain: this.withServerConversationId(
        published.keychain,
        keyEntry,
        conversation.id,
      ),
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }

  public async createGroupConversation(
    session: Session,
    input: { name: string; networkId: string; participantIds: string[] },
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    const participantIds = uniqueSorted([
      session.identity.id,
      ...input.participantIds,
    ]);
    const conversation = await this.postGroupConversation(session, {
      keychainExternalIdentifier: session.keychainExternalIdentifier ?? null,
      name: input.name.trim(),
      networkId: input.networkId,
      participantIds,
    });
    const keyEntry = await this.createGroupConversationKeyEntry(
      conversation.id,
    );
    const published = await this.publishKeychain(
      session,
      this.withConversationKey(session.keychain, keyEntry),
    );
    const invitedIdentities = await Promise.all(
      participantIds
        .filter((identityId) => identityId !== session.identity.id)
        .map((identityId) => this.getIdentity(identityId)),
    );

    await Promise.all(
      invitedIdentities.map((identity) =>
        this.createConversationInvitation(
          session,
          identity,
          keyEntry,
          'group_conversation_invitation',
        ),
      ),
    );

    return {
      conversation,
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }

  public async createGroupConversationInvitation(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): Promise<void> {
    const keyEntry = session.keychain.conversations[conversationId];

    if (!keyEntry) {
      throw new Error(copy.messages.missingConversationKey);
    }

    const recipientIdentity = await this.getIdentity(
      recipientIdentityId.trim(),
    );

    await this.createConversationInvitation(
      session,
      recipientIdentity,
      keyEntry,
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
    const normalizedRecipientIdentityId = recipientIdentityId.trim();
    const existingKeyEntry = session.keychain.conversations[communityId];

    if (
      await this.isPublicCommunityWithoutKey(
        session,
        communityId,
        existingKeyEntry,
      )
    ) {
      return await this.createPlainCommunityInvitation(
        session,
        communityId,
        normalizedRecipientIdentityId,
      );
    }

    const published = await this.publishCommunityKeyIfNeeded(
      session,
      communityId,
      existingKeyEntry,
    );
    const invitationSession = this.sessionWithPublishedKeychain(
      session,
      published,
    );

    await this.addCommunityMember(
      invitationSession,
      communityId,
      normalizedRecipientIdentityId,
    );
    await this.createCommunityInvitationNotification(
      invitationSession,
      communityId,
      normalizedRecipientIdentityId,
    );

    return {
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
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
    const path = `/communities/${encodeURIComponent(communityId)}/invites`;
    const existingKeyEntry = session.keychain.conversations[communityId];

    if (
      await this.isPublicCommunityWithoutKey(
        session,
        communityId,
        existingKeyEntry,
      )
    ) {
      return await this.createPlainCommunityInviteLink(session, path, input);
    }

    const published = await this.publishCommunityKeyIfNeeded(
      session,
      communityId,
      existingKeyEntry,
    );
    const encryptedKey = await encryptCommunityInviteKey(published.keyEntry);
    const body = communityInviteLinkBody(
      input,
      encryptedKey.encryptedCommunityKey,
    );
    const invite = await this.postCommunityInviteLink(session, path, body);

    return {
      invite,
      inviteSecret: encryptedKey.secret,
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
      keyEntry: published.keyEntry,
    };
  }

  private async isPublicCommunityWithoutKey(
    session: Session,
    communityId: string,
    existingKeyEntry?: ConversationKeyEntry,
  ): Promise<boolean> {
    if (existingKeyEntry) return false;

    const community = await this.getCommunity(session, communityId);

    return community.visibility === 'public';
  }

  private async createPlainCommunityInvitation(
    session: Session,
    communityId: string,
    recipientIdentityId: string,
  ): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: null | string;
  }> {
    await this.addCommunityMember(session, communityId, recipientIdentityId);

    return {
      keychain: session.keychain,
      keychainExternalIdentifier: session.keychainExternalIdentifier ?? null,
    };
  }

  private async publishCommunityKeyIfNeeded(
    session: Session,
    communityId: string,
    existingKeyEntry?: ConversationKeyEntry,
  ): Promise<PublishedCommunityKey> {
    const keyEntry =
      existingKeyEntry ??
      (await this.createGroupConversationKeyEntry(communityId));

    if (existingKeyEntry && session.keychainExternalIdentifier) {
      return {
        keychain: session.keychain,
        keychainExternalIdentifier: session.keychainExternalIdentifier,
        keyEntry,
      };
    }

    const published = await this.publishKeychain(
      session,
      this.withConversationKey(session.keychain, keyEntry),
    );

    return { keyEntry, ...published };
  }

  private sessionWithPublishedKeychain(
    session: Session,
    published: PublishedCommunityKey,
  ): Session {
    return {
      ...session,
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }

  private async createPlainCommunityInviteLink(
    session: Session,
    path: string,
    input: CommunityInviteLinkInput,
  ): Promise<{
    invite: CommunityInviteLinkResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: null | string;
  }> {
    const invite = await this.postCommunityInviteLink(
      session,
      path,
      communityInviteLinkBody(input),
    );

    return {
      invite,
      keychain: session.keychain,
      keychainExternalIdentifier: session.keychainExternalIdentifier ?? null,
    };
  }

  private async postCommunityInviteLink(
    session: Session,
    path: string,
    body: CommunityInviteLinkBody,
  ): Promise<CommunityInviteLinkResource> {
    return await this.http.request<CommunityInviteLinkResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  public async getCommunityInviteLink(
    inviteToken: string,
  ): Promise<CommunityInviteLinkResource> {
    return await this.http.request<CommunityInviteLinkResource>(
      `/communities/invites/${encodeURIComponent(inviteToken)}`,
    );
  }

  public async acceptCommunityInviteLink(
    session: Session,
    inviteToken: string,
  ): Promise<Community> {
    const path = `/communities/invites/${encodeURIComponent(
      inviteToken,
    )}/accept`;
    const body = {};

    return await this.http.request<Community>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
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
    const nextKeychain = this.withConversationKey(session.keychain, keyEntry);
    const published = await this.publishKeychain(session, nextKeychain);
    const community = await this.acceptCommunityInviteLink(
      {
        ...session,
        keychain: published.keychain,
        keychainExternalIdentifier: published.keychainExternalIdentifier,
      },
      inviteToken,
    );

    return {
      community,
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }

  public async createIdentity(
    name: string,
    password: string,
    networks: string[],
    handle?: string,
  ): Promise<IdentityResource> {
    const keyPair = await KeyPair.generate();
    const encryptedKeyPair = await keyPair.encryptKeyPair(password);
    const encryptedKeyPairPrimitives = encryptedKeyPair.toPrimitives();
    const identityId = IdentityId.normalize(keyPair.toPrimitives().publicKey);
    const path = '/identities/';
    const unsigned = this.identitySignatures.createInitial({
      encryptedKeyPair: encryptedKeyPairPrimitives,
      id: identityId,
      networks,
      profile: { handle, name },
      timestamp: Date.now(),
    });
    const signature = keyPair.sign(JSON.stringify(unsigned));
    const body = {
      ...unsigned,
      signature: signature.toString(),
    };
    const signingSession = {
      encryptedKeyPair,
      identity: {
        ...body,
      },
      keychain: defaultKeychain,
      password,
    } as Session;

    return await this.http.request<IdentityResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(signingSession, 'POST', path, body),
      method: 'POST',
    });
  }

  public async decryptKeychain(
    session: Session,
    keychain: KeychainResource,
  ): Promise<LocalKeychain> {
    return await this.keychains.decrypt(session, keychain);
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
    const normalizedIdentityId = IdentityId.normalize(identityId);
    const cached = this.identityCache.get(normalizedIdentityId);

    if (cached && Date.now() < cached.expiresAt) return cached.identity;

    const identity = await this.cachedRequest(
      `GET /identities/${normalizedIdentityId}`,
      () =>
        this.http.request<IdentityResource>(
          `/identities/${encodeURIComponent(normalizedIdentityId)}`,
        ),
    );

    this.cacheIdentity(identity);

    return identity;
  }

  public async updateIdentityProfile(
    session: Session,
    profile: IdentityUpdateProfileInput,
    newPassword?: string,
  ): Promise<IdentityResource> {
    const identityId = IdentityId.normalize(session.identity.id);
    const currentIdentity = await this.getIdentity(identityId);
    const previousIdentityExternalIdentifier =
      currentIdentity.identityExternalIdentifier ??
      currentIdentity.previousIdentityExternalIdentifier ??
      session.identity.identityExternalIdentifier ??
      session.identity.previousIdentityExternalIdentifier;

    if (!previousIdentityExternalIdentifier) {
      throw new Error(copy.profile.missingIdentityExternalIdentifier);
    }

    const encryptedKeyPair = newPassword
      ? await this.reEncryptKeyPair(session, newPassword)
      : undefined;
    const path = `/identities/${encodeURIComponent(identityId)}`;
    const unsigned = this.identitySignatures.createUpdate({
      encryptedKeyPair,
      identity: currentIdentity,
      previousIdentityExternalIdentifier,
      profile,
      timestamp: Date.now(),
    });
    const signature = await session.encryptedKeyPair.sign(
      JSON.stringify(unsigned),
      session.password,
    );
    const body = {
      ...unsigned,
      signature: signature.toString(),
    };

    const updatedIdentity = await this.http.request<IdentityResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PUT', path, body),
      method: 'PUT',
    });

    this.cacheIdentity(updatedIdentity);

    return updatedIdentity;
  }

  private cacheIdentity(identity: IdentityResource): void {
    this.identityCache.set(IdentityId.normalize(identity.id), {
      expiresAt: Date.now() + identityCacheTtlMs,
      identity,
    });
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
    attachment: PendingMessageAttachment,
  ): Promise<PrivateFileUpload> {
    return await this.files.uploadPrivateFile(session, attachment);
  }

  public async downloadAttachment(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    return await this.files.downloadAttachment(attachment, onProgress);
  }

  public async createNetwork(name: string, session?: Session): Promise<void> {
    await this.node.createNetwork(name, session);
  }

  public async createPublicNetwork(session?: Session): Promise<void> {
    await this.node.createPublicNetwork(session);
  }

  public async joinNetwork(
    id: string,
    name: string,
    key: string,
    session?: Session,
  ): Promise<void> {
    await this.node.joinNetwork(id, name, key, session);
  }

  public async removeNetwork(
    networkId: string,
    session?: Session,
  ): Promise<NodeNetwork[]> {
    return await this.node.removeNetwork(networkId, session);
  }

  public async listConversations(
    session: Session,
  ): Promise<ConversationResource[]> {
    const path = '/conversations/?limit=30';
    const raw = await this.cachedRequest(
      this.sessionCacheKey('GET', path, session),
      async () =>
        await this.http.request<unknown>(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
      { ttlMs: startupReadCacheTtlMs },
    );

    return this.conversations.list(raw);
  }

  public async markConversationReadUntil(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    const path = `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages/read-until`;
    const body = { messageId };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PUT', path, body),
      method: 'PUT',
    });
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
    const saved = await this.notifications.saveSetting(session, setting);

    this.invalidateSessionCacheKey('/notification-settings/', session);

    return saved;
  }

  public async resetNotificationSetting(
    session: Session,
    scope: NotificationSettingScope,
  ): Promise<void> {
    await this.notifications.resetSetting(session, scope);
    this.invalidateSessionCacheKey('/notification-settings/', session);
  }

  public async createLinkPreview(
    session: Session,
    url: string,
  ): Promise<MessageLinkPreview> {
    return await this.linkPreviews.create(session, url);
  }

  public async loadMessages(
    session: Session,
    conversationId: string,
    before?: null | string,
    limitOrOptions: MessageLoadOptions | number = 30,
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> {
    const options =
      typeof limitOrOptions === 'number'
        ? { limit: limitOrOptions }
        : limitOrOptions;
    const limit = options.limit ?? 30;
    const path = this.messagesPath(conversationId, before, limit);
    const raw = await this.cachedRequest(
      `GET ${path} ${session.identity.id}`,
      async () =>
        await this.http.request<unknown>(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
    );
    const normalized = this.messages.list(raw);

    return {
      messages: await this.decryptMessages(
        session,
        conversationId,
        normalized.messages,
        options.signal,
      ),
      nextCursor: normalized.nextCursor,
    };
  }

  public async loadMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<ChatMessage | null> {
    const path = this.messagePath(conversationId, messageId);
    const message = await this.http.request<MessageResource>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    if (message.type === 'deleted') return null;

    return await this.decryptMessage(session, conversationId, message);
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
    const path = this.messagesAroundPath(conversationId, messageId);
    const raw = await this.http.request<unknown>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });
    const envelope = raw as {
      messages?: MessageResource[];
      nextCursor?: null | string;
      previousCursor?: null | string;
    };
    const messages = envelope.messages ?? [];

    return {
      messages: await this.decryptMessages(session, conversationId, messages),
      nextCursor: envelope.nextCursor ?? null,
      previousCursor: envelope.previousCursor ?? null,
    };
  }

  public async loadMessageThread(
    session: Session,
    conversationId: string,
    messageId: string,
    options: { limit?: number } = {},
  ): Promise<{ messages: ChatMessage[]; nextBeforeMessageId?: null | string }> {
    const path = `${this.messagePath(conversationId, messageId)}/thread`;
    const query = new URLSearchParams({
      limit: String(options.limit ?? 50),
    });
    const result = await this.http.request<{
      messages?: MessageResource[];
      nextBeforeMessageId?: null | string;
    }>(`${path}?${query.toString()}`, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    return {
      messages: await this.decryptMessages(
        session,
        conversationId,
        result.messages ?? [],
      ),
      nextBeforeMessageId: result.nextBeforeMessageId ?? null,
    };
  }

  public async listMessagePins(
    session: Session,
    conversationId: string,
  ): Promise<MessagePin[]> {
    const path = `/conversations/${encodeURIComponent(conversationId)}/pins`;

    return await this.cachedRequest(
      this.sessionCacheKey('GET', path, session),
      async () => {
        const result = await this.http.request<ConversationMessagePinsResource>(
          path,
          {
            headers: await this.signer.headers(session, 'GET', path),
            method: 'GET',
          },
        );
        const messages = await this.decryptMessages(
          session,
          conversationId,
          result.pins.map((pin) => pin.message),
        );

        return result.pins.map((pin, index) => ({
          ...pin,
          message: messages[index],
        }));
      },
      { ttlMs: startupReadCacheTtlMs },
    );
  }

  public async pinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    const path = `${this.messagePath(conversationId, messageId)}/pin`;

    await this.http.request(path, {
      headers: await this.signer.headers(session, 'POST', path),
      method: 'POST',
    });
    this.invalidateConversationPinsCache(session, conversationId);
  }

  public async unpinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    const path = `${this.messagePath(conversationId, messageId)}/pin`;

    await this.http.request(path, {
      headers: await this.signer.headers(session, 'DELETE', path),
      method: 'DELETE',
    });
    this.invalidateConversationPinsCache(session, conversationId);
  }

  public async listConversationDrafts(
    session: Session,
  ): Promise<ConversationDraft[]> {
    const path = '/conversations/me/drafts';

    return await this.cachedRequest(
      this.sessionCacheKey('GET', path, session),
      async () => {
        const result = await this.http.request<ConversationDraftsResource>(
          path,
          {
            headers: await this.signer.headers(session, 'GET', path),
            method: 'GET',
          },
        );

        return await Promise.all(
          result.drafts.map(async (draft) => ({
            ...draft,
            content: await this.draftPayloads.decrypt(
              session,
              draft.encryptedPayload,
            ),
          })),
        );
      },
      { ttlMs: startupReadCacheTtlMs },
    );
  }

  public async saveConversationDraft(
    session: Session,
    conversationId: string,
    content: string,
    updatedAt = Date.now(),
  ): Promise<ConversationDraft> {
    const path = `/conversations/${encodeURIComponent(conversationId)}/draft`;
    const encryptedPayload = this.draftPayloads.encrypt(session, content);
    const body = { encryptedPayload, updatedAt };
    const draft = await this.http.request<Omit<ConversationDraft, 'content'>>(
      path,
      {
        body: JSON.stringify(body),
        headers: await this.signer.headers(session, 'PUT', path, body),
        method: 'PUT',
      },
    );
    this.invalidateSessionCacheKey('/conversations/me/drafts', session);

    return { ...draft, content };
  }

  public async deleteConversationDraft(
    session: Session,
    conversationId: string,
  ): Promise<void> {
    const path = `/conversations/${encodeURIComponent(conversationId)}/draft`;

    await this.http.request(path, {
      headers: await this.signer.headers(session, 'DELETE', path),
      method: 'DELETE',
    });
    this.invalidateSessionCacheKey('/conversations/me/drafts', session);
  }

  public async loadRemoteKeychain(session: Session): Promise<KeychainResource> {
    const path = `/keychains/${encodeURIComponent(session.identity.id)}`;

    return await this.cachedRequest(
      this.sessionCacheKey('GET', path, session),
      async () =>
        await this.http.request<KeychainResource>(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
      { ttlMs: startupReadCacheTtlMs },
    );
  }

  public async login(
    identityId: string,
    password: string,
  ): Promise<LoginResult> {
    const identity = await this.getIdentity(identityId.trim());
    const encryptedKeyPair = this.restoreEncryptedKeyPair(identity);

    try {
      await encryptedKeyPair.sign(
        new StringValueObject(`pigeon-swarm:login:${identity.id}`),
        new StringValueObject(password),
      );
    } catch {
      throw new Error(copy.auth.invalidLogin);
    }

    const session: Session = {
      encryptedKeyPair,
      identity,
      keychain: defaultKeychain,
      password,
    };
    const keychainResource = await this.loadRemoteKeychain(session).catch(
      (caught: unknown) => {
        if (this.isMissingRemoteKeychain(caught)) return undefined;

        throw caught;
      },
    );
    const keychain = keychainResource
      ? await this.decryptKeychain(session, keychainResource)
      : defaultKeychain;
    const hydratedSession = {
      ...session,
      keychain,
      keychainExternalIdentifier:
        keychainResource?.keychainExternalIdentifier ?? null,
    };
    const conversations = await this.listConversations(hydratedSession).catch(
      () => [],
    );

    return { conversations, session: hydratedSession };
  }

  public async publishKeychain(
    session: Session,
    nextKeychain: LocalKeychain,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> {
    const path = '/keychains/';
    const encrypted = await this.keychains.encryptForPublish(
      session,
      nextKeychain,
    );
    const published = await this.http.request<{
      keychainExternalIdentifier: string;
      ownerIdentityId: string;
      version: number;
    }>(path, {
      body: JSON.stringify(encrypted.body),
      headers: await this.signer.headers(session, 'POST', path, encrypted.body),
      method: 'POST',
    });
    this.invalidateSessionCacheKey(
      `/keychains/${encodeURIComponent(session.identity.id)}`,
      session,
    );

    return {
      keychain: encrypted.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }

  public async register(
    name: string,
    password: string,
    networks: string[],
    handle?: string,
  ): Promise<LoginResult> {
    const identity = await this.createIdentity(
      name,
      password,
      networks,
      handle,
    );

    return await this.login(identity.id, password);
  }

  public async sendMessage(
    session: Session,
    conversationId: string,
    content: string,
    options: SendMessageOptions = {},
  ): Promise<ChatMessage> {
    const {
      attachments = [],
      attachmentUpload,
      onAttachmentProgress,
      previousMessageIds = [],
      replyPreview,
      replyToMessageId,
      threadRootMessageId,
    } = options;
    const key = ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    );

    if (!key) {
      throw new Error(copy.messages.missingConversationKey);
    }

    const timestamp = Date.now();
    const messageAttachments = await this.publishMessageAttachments(
      session,
      attachments,
      onAttachmentProgress,
      attachmentUpload,
    );
    const attachmentExternalIdentifiers =
      AttachmentExternalIdentifiers.from(messageAttachments);
    const linkPreview = await this.createLinkPreviewForMessage(
      session,
      content,
      options,
    );
    const encryptedPayload = this.encryptMessagePayload({
      content,
      conversationId,
      eventType: threadRootMessageId
        ? options.sticker
          ? 'ThreadStickerMessageSent'
          : 'ThreadMessageSent'
        : undefined,
      key,
      linkPreview,
      messageAttachments,
      replyPreview,
      session,
      sticker: options.sticker,
      threadRootMessageId,
      timestamp,
    });
    const id = `${conversationId}:${timestamp}:${UUID.generate().toString()}`;
    const signature = await session.encryptedKeyPair.sign(
      JSON.stringify(
        this.messageSignatures.createSent({
          attachmentExternalIdentifiers,
          authorId: session.identity.id,
          conversationId,
          createdAt: timestamp,
          encryptedPayload,
          id,
          previousMessageIds,
          replyToMessageId,
        }),
      ),
      session.password,
    );
    const body = {
      attachmentExternalIdentifiers,
      createdAt: timestamp,
      encryptedPayload,
      id,
      previousMessageIds,
      ...(replyToMessageId ? { replyToMessageId } : {}),
      signature: signature.toString(),
    };
    const path = `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages`;
    const created = await this.http.request<MessageResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });

    return await this.decryptMessage(session, conversationId, created);
  }

  public async editMessage(
    session: Session,
    conversationId: string,
    messageId: string,
    content: string,
    options: EditMessageOptions = {},
  ): Promise<ChatMessage> {
    const key = ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    );

    if (!key) {
      throw new Error(copy.messages.missingConversationKey);
    }

    const timestamp = Date.now();
    const linkPreview =
      options.linkPreview ??
      (await this.createLinkPreviewForContent(session, content));
    const encryptedPayload = this.encryptMessagePayload({
      content,
      conversationId,
      eventType: 'MessageEdited',
      key,
      linkPreview,
      messageAttachments: [],
      session,
      timestamp,
    });
    const id = `${conversationId}:${timestamp}:${UUID.generate().toString()}:edited`;
    const previousMessageIds = [messageId];
    const signature = await session.encryptedKeyPair.sign(
      JSON.stringify(
        this.messageSignatures.createEdited({
          authorId: session.identity.id,
          conversationId,
          createdAt: timestamp,
          encryptedPayload,
          id,
          targetMessageId: messageId,
        }),
      ),
      session.password,
    );
    /* eslint-disable perfectionist/sort-objects */
    const body = {
      id,
      createdAt: timestamp,
      encryptedPayload,
      previousMessageIds,
      signature: signature.toString(),
    };
    /* eslint-enable perfectionist/sort-objects */
    const path = `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages/${encodeURIComponent(messageId)}`;
    const edited = await this.http.request<MessageResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PUT', path, body),
      method: 'PUT',
    });

    return await this.decryptMessage(session, conversationId, edited);
  }

  public async deleteMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    const createdAt = Date.now();
    const id = `${conversationId}:${createdAt}:${UUID.generate().toString()}:deleted`;
    const signature = await session.encryptedKeyPair.sign(
      JSON.stringify(
        this.messageSignatures.createDeleted({
          authorId: session.identity.id,
          conversationId,
          createdAt,
          id,
          targetMessageId: messageId,
        }),
      ),
      session.password,
    );
    const body = {
      createdAt,
      id,
      signature: signature.toString(),
    };
    const path = `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages/${encodeURIComponent(messageId)}`;

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'DELETE', path, body),
      method: 'DELETE',
    });
  }

  public async addMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    const path = this.messageReactionsPath(conversationId, messageId);
    const body = { emoji };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  public async removeMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    const path = this.messageReactionsPath(conversationId, messageId);
    const body = { emoji };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'DELETE', path, body),
      method: 'DELETE',
    });
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
    const decrypted = await session.encryptedKeyPair.decrypt(
      new EncryptedPayload(encryptedKey),
      session.password,
    );
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
          privateKey: key?.privateKey,
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

  private async createLinkPreviewForContent(
    session: Session,
    content: string,
  ): Promise<MessageLinkPreview | undefined> {
    const url = MessageLinkPreviews.firstUrl(content);

    if (!url) return undefined;

    return await this.createLinkPreview(session, url).catch(() => undefined);
  }

  private async createLinkPreviewForMessage(
    session: Session,
    content: string,
    options: SendMessageOptions,
  ): Promise<MessageLinkPreview | undefined> {
    if (options.linkPreview || options.sticker) return options.linkPreview;

    return await this.createLinkPreviewForContent(session, content);
  }

  private encryptMessagePayload(input: EncryptMessagePayloadInput): string {
    return PublicKey.fromPEM(input.key.publicKey)
      .encrypt(
        JSON.stringify({
          attachments: input.messageAttachments,
          authorIdentityId: input.session.identity.id,
          content: input.sticker ? '' : input.content,
          conversationId: input.conversationId,
          ...(input.linkPreview ? { linkPreview: input.linkPreview } : {}),
          ...(input.replyPreview ? { reply: input.replyPreview } : {}),
          ...(input.sticker ? { sticker: input.sticker } : {}),
          ...(input.threadRootMessageId
            ? { threadRootMessageId: input.threadRootMessageId }
            : {}),
          timestamp: input.timestamp,
          type:
            input.eventType ??
            (input.sticker ? 'StickerMessageSent' : 'MessageSent'),
        }),
      )
      .toString();
  }

  private async projectMessageDirect(
    session: Session,
    conversationId: string,
    message: MessageResource,
  ): Promise<ChatMessage> {
    return await this.messages.toChatMessage(session, conversationId, message);
  }

  private async getMessageDecryptWorker(): Promise<MessageDecryptWorker> {
    if (this.messageDecryptWorker) return this.messageDecryptWorker;

    const { MessageDecryptWorkerClient } =
      await import('../../modules/messages/infrastructure/crypto/MessageDecryptWorkerClient');

    this.messageDecryptWorker = new MessageDecryptWorkerClient();

    return this.messageDecryptWorker;
  }

  private isMissingRemoteKeychain(caught: unknown): boolean {
    return (
      caught instanceof HttpJsonError &&
      (caught.code === 'KeychainNotFoundError' ||
        caught.code === 'IdentityNotFoundError')
    );
  }

  private async createConversationInvitation(
    session: Session,
    peerIdentity: IdentityResource,
    keyEntry: ConversationKeyEntry,
    type: ConversationInvitationType = 'conversation_invitation',
  ): Promise<void> {
    const path = '/notifications/';
    const recipientKeyEntry = {
      ...keyEntry,
      peerIdentityId: session.identity.id,
    };
    const encryptedConversationKey = PublicKey.fromPEM(
      peerIdentity.encryptedKeyPair.publicKey,
    )
      .encrypt(JSON.stringify(recipientKeyEntry))
      .toString();
    const inviterSignature = await session.encryptedKeyPair.sign(
      JSON.stringify({
        conversationId: keyEntry.conversationId,
        encryptedConversationKey,
        inviterIdentityId: session.identity.id,
        recipientIdentityId: peerIdentity.id,
      }),
      session.password,
    );
    const body = {
      conversationId: keyEntry.conversationId,
      encryptedConversationKey,
      inviterIdentityId: session.identity.id,
      inviterSignature: inviterSignature.toString(),
      recipientIdentityId: peerIdentity.id,
      type,
    };

    await this.http.request<NotificationResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  private async createCommunityInvitationNotification(
    session: Session,
    communityId: string,
    recipientIdentityId: string,
  ): Promise<void> {
    const keyEntry = session.keychain.conversations[communityId];

    if (!keyEntry) {
      throw new Error(copy.messages.missingConversationKey);
    }

    const recipientIdentity = await this.getIdentity(recipientIdentityId);

    await this.createEncryptedCommunityInvitation(
      session,
      recipientIdentity,
      keyEntry,
    );
  }

  private async createEncryptedCommunityInvitation(
    session: Session,
    recipientIdentity: IdentityResource,
    keyEntry: ConversationKeyEntry,
  ): Promise<void> {
    const path = '/notifications/';
    const recipientKeyEntry = {
      ...keyEntry,
      peerIdentityId: session.identity.id,
    };
    const encryptedCommunityKey = PublicKey.fromPEM(
      recipientIdentity.encryptedKeyPair.publicKey,
    )
      .encrypt(JSON.stringify(recipientKeyEntry))
      .toString();
    const inviterSignature = await session.encryptedKeyPair.sign(
      JSON.stringify({
        communityId: keyEntry.conversationId,
        encryptedCommunityKey,
        inviterIdentityId: session.identity.id,
        recipientIdentityId: recipientIdentity.id,
      }),
      session.password,
    );
    const body = {
      communityId: keyEntry.conversationId,
      encryptedCommunityKey,
      inviterIdentityId: session.identity.id,
      inviterSignature: inviterSignature.toString(),
      recipientIdentityId: recipientIdentity.id,
      type: 'community_invitation',
    };

    await this.http.request<NotificationResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  private async createConversationKeyEntry(
    identityId: string,
    peerIdentityId: string,
    networkId: string,
  ): Promise<ConversationKeyEntry> {
    const conversationKeyPair = await KeyPair.generate();
    const keyPairPrimitives = conversationKeyPair.toPrimitives();
    const conversationId = this.deterministicConversationId(
      identityId,
      peerIdentityId,
      networkId,
    );

    return {
      conversationId,
      createdAt: Date.now(),
      peerIdentityId,
      privateKey: keyPairPrimitives.privateKey,
      publicKey: keyPairPrimitives.publicKey,
    };
  }

  private async createGroupConversationKeyEntry(
    conversationId: string,
  ): Promise<ConversationKeyEntry> {
    const conversationKeyPair = await KeyPair.generate();
    const keyPairPrimitives = conversationKeyPair.toPrimitives();

    return {
      conversationId,
      createdAt: Date.now(),
      peerIdentityId: '',
      privateKey: keyPairPrimitives.privateKey,
      publicKey: keyPairPrimitives.publicKey,
    };
  }

  private restoreEncryptedKeyPair(
    identity: IdentityResource,
  ): EncryptedKeyPair {
    return new EncryptedKeyPair(
      PublicKey.fromPEM(
        new StringValueObject(identity.encryptedKeyPair.publicKey),
      ),
      new EncryptedPrivateKey(
        new StringValueObject(identity.encryptedKeyPair.encryptedPrivateKey),
      ),
    );
  }

  private async reEncryptKeyPair(
    session: Session,
    newPassword: string,
  ): Promise<IdentityResource['encryptedKeyPair']> {
    const privateKey = await new EncryptedPrivateKey(
      new StringValueObject(
        session.identity.encryptedKeyPair.encryptedPrivateKey,
      ),
    ).decrypt(new StringValueObject(session.password));
    const encryptedKeyPair = await EncryptedKeyPair.encryptKeyPair(
      PublicKey.fromPEM(
        new StringValueObject(session.identity.encryptedKeyPair.publicKey),
      ),
      privateKey,
      new StringValueObject(newPassword),
    );

    return encryptedKeyPair.toPrimitives();
  }

  private messagesPath(
    conversationId: string,
    before?: null | string,
    limit = 30,
  ): string {
    const query = new URLSearchParams({ limit: `${limit}` });

    if (before) {
      query.set('beforeMessageId', before);
    }

    return `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages?${query.toString()}`;
  }

  private messagePath(conversationId: string, messageId: string): string {
    return `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages/${encodeURIComponent(messageId)}`;
  }

  private messageReactionsPath(
    conversationId: string,
    messageId: string,
  ): string {
    return `${this.messagePath(conversationId, messageId)}/reactions`;
  }

  private communityChannelMessageReactionsPath(
    communityId: string,
    channelId: string,
    messageId: string,
  ): string {
    return `/communities/${encodeURIComponent(
      communityId,
    )}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(
      messageId,
    )}/reactions`;
  }

  private messagesAroundPath(
    conversationId: string,
    messageId: string,
  ): string {
    const query = new URLSearchParams({ after: '20', before: '20' });

    return `${this.messagePath(
      conversationId,
      messageId,
    )}/around?${query.toString()}`;
  }

  private async cachedRequest<T>(
    key: string,
    loader: () => Promise<T>,
    options: CachedRequestOptions = {},
  ): Promise<T> {
    const now = Date.now();
    const cached = this.requestCache.get(key) as
      | CachedRequestEntry<T>
      | undefined;

    if (cached && (!cached.settled || cached.expiresAt > now)) {
      return await cached.promise;
    }

    if (cached) this.requestCache.delete(key);

    const entry: CachedRequestEntry<T> = {
      expiresAt: Number.POSITIVE_INFINITY,
      promise: Promise.resolve(undefined as T),
      settled: false,
    };

    entry.promise = Promise.resolve()
      .then(loader)
      .then((result) => {
        entry.settled = true;
        entry.expiresAt = Date.now() + (options.ttlMs ?? 0);

        if (!options.ttlMs && this.requestCache.get(key) === entry) {
          this.requestCache.delete(key);
        }

        return result;
      })
      .catch((caught: unknown) => {
        if (this.requestCache.get(key) === entry) {
          this.requestCache.delete(key);
        }

        throw caught;
      });

    this.requestCache.set(key, entry);

    return await entry.promise;
  }

  private sessionCacheKey(
    method: 'GET',
    path: string,
    session: Session,
  ): string {
    return `${method} ${path} ${session.identity.id}`;
  }

  private invalidateSessionCacheKey(path: string, session: Session): void {
    this.requestCache.delete(this.sessionCacheKey('GET', path, session));
  }

  private invalidateConversationPinsCache(
    session: Session,
    conversationId: string,
  ): void {
    this.invalidateSessionCacheKey(
      `/conversations/${encodeURIComponent(conversationId)}/pins`,
      session,
    );
  }

  private invalidateCommunityChannelPinsCache(
    session: Session,
    communityId: string,
    channelId: string,
  ): void {
    this.invalidateSessionCacheKey(
      `/communities/${encodeURIComponent(
        communityId,
      )}/channels/${encodeURIComponent(channelId)}/pins`,
      session,
    );
  }

  private async postConversation(
    session: Session,
    peerIdentityId: string,
    published: {
      keychain: LocalKeychain;
      keychainExternalIdentifier: string;
    },
    networkId: string,
  ): Promise<ConversationResource> {
    const body = {
      keychainExternalIdentifier: published.keychainExternalIdentifier,
      networkId,
      participantIds: [session.identity.id, peerIdentityId].sort(),
      type: 'one-to-one',
    };
    const path = '/conversations';
    const created = await this.http.request<ConversationResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(
        {
          ...session,
          keychain: published.keychain,
          keychainExternalIdentifier: published.keychainExternalIdentifier,
        },
        'POST',
        path,
        body,
      ),
      method: 'POST',
    });
    this.invalidateSessionCacheKey('/conversations/?limit=30', session);

    return this.conversations.normalize(created, peerIdentityId);
  }

  private async postGroupConversation(
    session: Session,
    input: {
      keychainExternalIdentifier: null | string;
      name: string;
      networkId: string;
      participantIds: string[];
    },
  ): Promise<ConversationResource> {
    const body = {
      keychainExternalIdentifier: input.keychainExternalIdentifier,
      name: input.name,
      networkId: input.networkId,
      participantIds: input.participantIds,
      type: 'group',
    };
    const path = '/conversations';
    const created = await this.http.request<ConversationResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
    this.invalidateSessionCacheKey('/conversations/?limit=30', session);

    return this.conversations.normalize(created);
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

  private withServerConversationId(
    keychain: LocalKeychain,
    keyEntry: ConversationKeyEntry,
    conversationId: string,
  ): LocalKeychain {
    if (conversationId === keyEntry.conversationId) {
      return keychain;
    }

    return {
      ...keychain,
      conversations: {
        ...keychain.conversations,
        [conversationId]: { ...keyEntry, conversationId },
      },
    };
  }
}
