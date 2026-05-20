import { KeyPair } from '@haskou/value-objects';

import type {
  CallIceServerConfig,
  CallResource,
  CallSignalPayload,
} from '../../modules/calls/domain/callSession.types';
import type { IdentityUpdateProfileInput } from '../../modules/identities/domain/identitySignaturePayloadFactory';
import type {
  AttachmentProgress,
  AttachmentUploadOptions,
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
  CommunityVoiceChannel,
  ConversationKeyEntry,
  ConversationResource,
  CreatePollInput,
  IdentityResource,
  IdentityPresence,
  IpfsReplicationStatus,
  LocalKeychain,
  LoginResult,
  MessageLinkPreview,
  MessageAttachment,
  MessageResource,
  MyStickersResource,
  NotificationResource,
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

import { PigeonApiGateway } from './pigeonApiGateway';
import {
  RealtimeGateway,
  type RealtimeHeartbeatActivityMode,
  type RealtimeMessage,
  type RealtimeTypingInput,
} from '../../shared/infrastructure/realtime/realtimeGateway';
import { AcceptConversationInvitation } from '../../modules/notifications/application/accept-conversation-invitation/acceptConversationInvitation';
import { AcceptConversationInvitationMessage } from '../../modules/notifications/application/accept-conversation-invitation/messages/acceptConversationInvitationMessage';
import { ListNotifications } from '../../modules/notifications/application/list-notifications/listNotifications';
import { ListNotificationsMessage } from '../../modules/notifications/application/list-notifications/messages/listNotificationsMessage';
import { UpdateNotificationMessage } from '../../modules/notifications/application/update-notification/messages/updateNotificationMessage';
import { UpdateNotification } from '../../modules/notifications/application/update-notification/updateNotification';
import { CreateConversation } from '../../modules/conversations/application/create-conversation/createConversation';
import {
  CreateGroupConversation,
  type CreateGroupConversationInput,
} from '../../modules/conversations/application/create-group-conversation/createGroupConversation';
import { ListConversations } from '../../modules/conversations/application/list-conversations/listConversations';
import { LoginIdentity } from '../../modules/identities/application/login-identity/loginIdentity';
import { RegisterIdentity } from '../../modules/identities/application/register-identity/registerIdentity';
import { AddMessageReaction } from '../../modules/messages/application/add-message-reaction/addMessageReaction';
import { DeleteMessage } from '../../modules/messages/application/delete-message/deleteMessage';
import { LoadMessage } from '../../modules/messages/application/load-message/loadMessage';
import { LoadMessages } from '../../modules/messages/application/load-messages/loadMessages';
import { LoadMessagesAround } from '../../modules/messages/application/load-messages-around/loadMessagesAround';
import { RemoveMessageReaction } from '../../modules/messages/application/remove-message-reaction/removeMessageReaction';
import { SendMessage } from '../../modules/messages/application/send-message/sendMessage';
import { CreateNetwork } from '../../modules/networks/application/create-network/createNetwork';
import { JoinNetwork } from '../../modules/networks/application/join-network/joinNetwork';
import {
  ListNodeNetworks,
  type NodeNetwork,
} from '../../modules/networks/application/list-node-networks/listNodeNetworks';
import { ListPeers, type Peer } from '../../modules/peers/application/list-peers/listPeers';

function pushSubscriptionPayload(subscription: PushSubscriptionJSON): {
  endpoint: string;
  expirationTime?: number | null;
  keys: { auth: string; p256dh: string };
} {
  if (
    !subscription.endpoint ||
    !subscription.keys?.auth ||
    !subscription.keys.p256dh
  ) {
    throw new Error('Invalid push subscription.');
  }

  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime,
    keys: {
      auth: subscription.keys.auth,
      p256dh: subscription.keys.p256dh,
    },
  };
}

export class PigeonApplication {
  private readonly gateway: PigeonApiGateway;

  private readonly realtime: RealtimeGateway;

  private readonly acceptInvitationUseCase: AcceptConversationInvitation;

  private readonly createConversationUseCase: CreateConversation;

  private readonly createGroupConversationUseCase: CreateGroupConversation;

  private readonly createNetworkUseCase: CreateNetwork;

  private readonly joinNetworkUseCase: JoinNetwork;

  private readonly deleteMessageUseCase: DeleteMessage;

  private readonly addMessageReactionUseCase: AddMessageReaction;

  private readonly listConversationsUseCase: ListConversations;

  private readonly listNodeNetworksUseCase: ListNodeNetworks;

  private readonly listNotificationsUseCase: ListNotifications;

  private readonly listPeersUseCase: ListPeers;

  private readonly loadMessagesUseCase: LoadMessages;

  private readonly loadMessageUseCase: LoadMessage;

  private readonly loadMessagesAroundUseCase: LoadMessagesAround;

  private readonly loginIdentityUseCase: LoginIdentity;

  private readonly registerIdentityUseCase: RegisterIdentity;

  private readonly removeMessageReactionUseCase: RemoveMessageReaction;

  private readonly sendMessageUseCase: SendMessage;

  private readonly updateNotificationUseCase: UpdateNotification;

  public constructor(
    gateway: PigeonApiGateway = new PigeonApiGateway(),
    realtime: RealtimeGateway = new RealtimeGateway(),
  ) {
    this.gateway = gateway;
    this.realtime = realtime;
    this.acceptInvitationUseCase = new AcceptConversationInvitation(gateway);
    this.createConversationUseCase = new CreateConversation(gateway);
    this.createGroupConversationUseCase = new CreateGroupConversation(gateway);
    this.createNetworkUseCase = new CreateNetwork(gateway);
    this.addMessageReactionUseCase = new AddMessageReaction(gateway);
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
    this.removeMessageReactionUseCase = new RemoveMessageReaction(gateway);
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
    return await this.acceptInvitationUseCase.accept(
      new AcceptConversationInvitationMessage({ notification, session }),
    );
  }

  public async claimNode(session: Session): Promise<void> {
    await this.gateway.claimNode(session);
  }

  public async listCalls(session: Session): Promise<CallResource[]> {
    return await this.gateway.listCalls(session);
  }

  public async getCall(
    session: Session,
    callId: string,
  ): Promise<CallResource> {
    return await this.gateway.getCall(session, callId);
  }

  public async getCallIceServers(
    session: Session,
  ): Promise<CallIceServerConfig> {
    return await this.gateway.getCallIceServers(session);
  }

  public async getIpfsReplicationStatus(
    session: Session,
  ): Promise<IpfsReplicationStatus> {
    return await this.gateway.getIpfsReplicationStatus(session);
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

  public async startConversationCall(
    session: Session,
    conversationId: string,
  ): Promise<CallResource> {
    return await this.gateway.startConversationCall(session, conversationId);
  }

  public async startCommunityChannelCall(
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

  public async joinCall(
    session: Session,
    callId: string,
  ): Promise<CallResource> {
    return await this.gateway.joinCall(session, callId);
  }

  public async leaveCall(session: Session, callId: string): Promise<void> {
    await this.gateway.leaveCall(session, callId);
  }

  public async heartbeatCallParticipant(
    session: Session,
    callId: string,
  ): Promise<void> {
    await this.gateway.heartbeatCallParticipant(session, callId);
  }

  public async endCall(session: Session, callId: string): Promise<void> {
    await this.gateway.endCall(session, callId);
  }

  public async sendCallSignal(
    session: Session,
    callId: string,
    signal: CallSignalPayload,
  ): Promise<void> {
    await this.gateway.sendCallSignal(session, callId, signal);
  }

  public async connectRealtime(
    session: Session,
    onMessage: (message: RealtimeMessage) => void,
  ): Promise<WebSocket> {
    return await this.realtime.connect(session, onMessage);
  }

  public setRealtimeHeartbeatActivityMode(
    session: Session,
    mode: RealtimeHeartbeatActivityMode,
  ): void {
    this.realtime.setHeartbeatActivityMode(session, mode);
  }

  public sendRealtimeTyping(
    socket: WebSocket,
    input: RealtimeTypingInput,
  ): void {
    this.realtime.sendTyping(socket, input);
  }

  public async getPushVapidPublicKey(): Promise<{
    enabled: boolean;
    publicKey?: string;
  }> {
    return await this.gateway.getPushVapidPublicKey();
  }

  public async registerPushSubscription(
    session: Session,
    subscription: PushSubscriptionJSON,
  ): Promise<void> {
    await this.gateway.registerPushSubscription(
      session,
      pushSubscriptionPayload(subscription),
    );
  }

  public async deletePushSubscription(
    session: Session,
    subscription: PushSubscriptionJSON,
  ): Promise<void> {
    await this.gateway.deletePushSubscription(
      session,
      pushSubscriptionPayload(subscription),
    );
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

  public async createGroupConversation(
    session: Session,
    input: CreateGroupConversationInput,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    return await this.createGroupConversationUseCase.execute(session, input);
  }

  public async createNetwork(name: string): Promise<void> {
    await this.createNetworkUseCase.execute(name);
  }

  public async listCommunities(session: Session): Promise<Community[]> {
    return await this.gateway.listCommunities(session);
  }

  public async getCommunity(
    session: Session,
    communityId: string,
  ): Promise<Community> {
    return await this.gateway.getCommunity(session, communityId);
  }

  public async listCommunityModerationLogs(
    session: Session,
    communityId: string,
    input?: { beforeLogId?: string; limit?: number },
  ): Promise<CommunityModerationLogPage> {
    return await this.gateway.listCommunityModerationLogs(
      session,
      communityId,
      input,
    );
  }

  public async discoverCommunities(
    session: Session,
    input: { networkId?: string; query?: string },
  ): Promise<CommunityDiscoveryResource[]> {
    return await this.gateway.discoverCommunities(session, input);
  }

  public async createCommunity(
    session: Session,
    input: {
      avatar?: File | null;
      banner?: File | null;
      channels?: Array<{ name: string; type: 'text' | 'voice' }>;
      description: string;
      name: string;
      networkId: string;
    },
  ): Promise<{
    community: Community;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    const avatarCid = input.avatar
      ? (await this.uploadPublicFile(session, input.avatar)).cid
      : undefined;
    const bannerCid = input.banner
      ? (await this.uploadPublicFile(session, input.banner)).cid
      : undefined;

    const community = await this.gateway.createCommunity(session, {
      ...(avatarCid ? { avatar: avatarCid } : {}),
      ...(bannerCid ? { banner: bannerCid } : {}),
      description: input.description,
      name: input.name,
      networkId: input.networkId,
    });
    const keyEntry = await this.createCommunityKeyEntry(community.id);
    const published = await this.publishKeychain(session, {
      ...session.keychain,
      conversations: {
        ...session.keychain.conversations,
        [community.id]: keyEntry,
      },
    });
    const channelSession = {
      ...session,
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
    const initialChannels = await this.createInitialCommunityChannels(
      channelSession,
      community.id,
      input.channels ?? [],
    );

    return {
      community: {
        ...community,
        textChannels: [
          ...community.textChannels,
          ...initialChannels.textChannels,
        ],
        voiceChannels:
          initialChannels.voiceChannels.length > 0
            ? [
                ...(community.voiceChannels ?? []),
                ...initialChannels.voiceChannels,
              ]
            : community.voiceChannels,
      },
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }

  public async updateCommunity(
    session: Session,
    communityId: string,
    input: {
      avatar?: File | null | string;
      banner?: File | null | string;
      description?: string;
      name?: string;
    },
  ): Promise<Community> {
    const resolvePublicImageCid = async (
      value: File | null | string | undefined,
    ): Promise<string | undefined> => {
      if (!value) return undefined;

      if (typeof value === 'string') return value;

      return (await this.uploadPublicFile(session, value)).cid;
    };
    const avatarCid = await resolvePublicImageCid(input.avatar);
    const bannerCid = await resolvePublicImageCid(input.banner);

    return await this.gateway.updateCommunity(session, communityId, {
      ...(avatarCid ? { avatar: avatarCid } : {}),
      ...(bannerCid ? { banner: bannerCid } : {}),
      description: input.description,
      name: input.name,
    });
  }

  public async addCommunityMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<CommunityMembershipRequest> {
    return await this.gateway.addCommunityMember(
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
    return await this.gateway.banCommunityMember(
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
    return await this.gateway.unbanCommunityMember(
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
    return await this.gateway.kickCommunityMember(
      session,
      communityId,
      identityId,
    );
  }

  public async createCommunityJoinRequest(
    session: Session,
    communityId: string,
  ): Promise<CommunityMembershipRequest> {
    return await this.gateway.createCommunityJoinRequest(session, communityId);
  }

  public async listCommunityMembershipRequests(
    session: Session,
  ): Promise<CommunityMembershipRequest[]> {
    return await this.gateway.listCommunityMembershipRequests(session);
  }

  public async updateCommunityMembershipRequest(
    session: Session,
    requestId: string,
    status: Extract<CommunityMembershipRequestStatus, 'accepted' | 'declined'>,
  ): Promise<CommunityMembershipRequest> {
    return await this.gateway.updateCommunityMembershipRequest(
      session,
      requestId,
      status,
    );
  }

  public async leaveCommunity(
    session: Session,
    communityId: string,
  ): Promise<Community> {
    return await this.gateway.leaveCommunity(session, communityId);
  }

  public async createGroupConversationInvitation(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): Promise<void> {
    await this.gateway.createGroupConversationInvitation(
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
    keychainExternalIdentifier: string;
  }> {
    return await this.gateway.createCommunityInvitation(
      session,
      communityId,
      recipientIdentityId,
    );
  }

  public async createCommunityInviteLink(
    session: Session,
    communityId: string,
    input: { expiresAt?: string; maxUses?: number } = {},
  ): Promise<{
    invite: CommunityInviteLinkResource;
    keyEntry: ConversationKeyEntry;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    return await this.gateway.createCommunityInviteLink(
      session,
      communityId,
      input,
    );
  }

  public async acceptCommunityInviteLink(
    session: Session,
    inviteToken: string,
  ): Promise<Community> {
    return await this.gateway.acceptCommunityInviteLink(session, inviteToken);
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
    return await this.gateway.acceptCommunityInviteLinkWithKey(
      session,
      inviteToken,
      keyEntry,
    );
  }

  public async listCommunityMembers(
    session: Session,
    communityId: string,
  ): Promise<string[]> {
    return await this.gateway.listCommunityMembers(session, communityId);
  }

  public async listCommunityRoles(
    session: Session,
    communityId: string,
  ): Promise<CommunityRoleResource[]> {
    return await this.gateway.listCommunityRoles(session, communityId);
  }

  public async createCommunityRole(
    session: Session,
    communityId: string,
    input: { name: string; permissions: CommunityPermission[] },
  ): Promise<CommunityRoleResource> {
    return await this.gateway.createCommunityRole(session, communityId, input);
  }

  public async updateCommunityRole(
    session: Session,
    communityId: string,
    roleId: string,
    input: { name: string; permissions: CommunityPermission[] },
  ): Promise<CommunityRoleResource> {
    return await this.gateway.updateCommunityRole(
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
    await this.gateway.deleteCommunityRole(session, communityId, roleId);
  }

  public async assignCommunityMemberRoles(
    session: Session,
    communityId: string,
    identityId: string,
    roleIds: string[],
  ): Promise<Community> {
    return await this.gateway.assignCommunityMemberRoles(
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
    return await this.gateway.createCommunityTextChannel(
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
    return await this.gateway.createCommunityVoiceChannel(
      session,
      communityId,
      name,
    );
  }

  public async listCommunityChannels(
    session: Session,
    communityId: string,
  ): Promise<CommunityChannel[]> {
    return await this.gateway.listCommunityChannels(session, communityId);
  }

  public async renameCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
    name: string,
  ): Promise<CommunityChannel> {
    return await this.gateway.renameCommunityChannel(
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
    return await this.gateway.deleteCommunityChannel(
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
    return await this.gateway.updateCommunityChannelPermissions(
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
    input: {
      attachmentExternalIdentifiers?: string[];
      encryptedPayload: string;
      id?: string;
      mentions?: CommunityMessageMention[];
      timestamp?: number;
    },
  ): Promise<MessageResource> {
    return await this.gateway.createCommunityChannelMessage(
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
    return await this.gateway.listCommunityChannelMessages(
      session,
      communityId,
      channelId,
      options,
    );
  }

  public async deleteCommunityChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
  ): Promise<void> {
    await this.gateway.deleteCommunityChannelMessage(
      session,
      communityId,
      channelId,
      messageId,
    );
  }

  public async publishMessageAttachments(
    session: Session,
    attachments: File[],
    onProgress?: (progress: AttachmentProgress) => void,
    options?: AttachmentUploadOptions,
  ): Promise<MessageAttachment[]> {
    return await this.gateway.publishMessageAttachments(
      session,
      attachments,
      onProgress,
      options,
    );
  }

  public async createLinkPreview(
    session: Session,
    url: string,
  ): Promise<MessageLinkPreview> {
    return await this.gateway.createLinkPreview(session, url);
  }

  public async createPoll(
    session: Session,
    input: CreatePollInput,
  ): Promise<PollResource> {
    return await this.gateway.createPoll(session, input);
  }

  public async getPoll(
    session: Session,
    pollId: string,
  ): Promise<PollResource> {
    return await this.gateway.getPoll(session, pollId);
  }

  public async votePoll(
    session: Session,
    pollId: string,
    optionIds: string[],
  ): Promise<PollResource> {
    return await this.gateway.votePoll(session, pollId, optionIds);
  }

  public async removePollVote(
    session: Session,
    pollId: string,
  ): Promise<PollResource> {
    return await this.gateway.removePollVote(session, pollId);
  }

  public async closePoll(
    session: Session,
    pollId: string,
  ): Promise<PollResource> {
    return await this.gateway.closePoll(session, pollId);
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

  public async addMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.addMessageReactionUseCase.execute(
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
    await this.removeMessageReactionUseCase.execute(
      session,
      conversationId,
      messageId,
      emoji,
    );
  }

  public async addCommunityChannelMessageReaction(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.gateway.addCommunityChannelMessageReaction(
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
    await this.gateway.removeCommunityChannelMessageReaction(
      session,
      communityId,
      channelId,
      messageId,
      emoji,
    );
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

  public async uploadStickerAsset(
    session: Session,
    file: File,
  ): Promise<PublicFileUpload> {
    return await this.gateway.uploadStickerAsset(session, file);
  }

  public async listStickerPacks(
    input: {
      ownerIdentityId?: string;
    } = {},
  ): Promise<StickerPackResource[]> {
    return await this.gateway.listStickerPacks(input);
  }

  public async getStickerPack(packId: string): Promise<StickerPackResource> {
    return await this.gateway.getStickerPack(packId);
  }

  public async getMyStickers(session: Session): Promise<MyStickersResource> {
    return await this.gateway.getMyStickers(session);
  }

  public async createStickerPack(
    session: Session,
    input: StickerPackInput,
  ): Promise<StickerPackResource> {
    return await this.gateway.createStickerPack(session, input);
  }

  public async updateStickerPack(
    session: Session,
    packId: string,
    input: Partial<StickerPackInput>,
  ): Promise<StickerPackResource> {
    return await this.gateway.updateStickerPack(session, packId, input);
  }

  public async addStickerToPack(
    session: Session,
    packId: string,
    input: StickerInput,
  ): Promise<StickerResource> {
    return await this.gateway.addStickerToPack(session, packId, input);
  }

  public async updateSticker(
    session: Session,
    packId: string,
    stickerId: string,
    input: StickerInput,
  ): Promise<StickerResource> {
    return await this.gateway.updateSticker(session, packId, stickerId, input);
  }

  public async deleteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.gateway.deleteSticker(session, packId, stickerId);
  }

  public async saveStickerPack(
    session: Session,
    packId: string,
  ): Promise<void> {
    await this.gateway.saveStickerPack(session, packId);
  }

  public async unsaveStickerPack(
    session: Session,
    packId: string,
  ): Promise<void> {
    await this.gateway.unsaveStickerPack(session, packId);
  }

  public async favoriteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.gateway.favoriteSticker(session, packId, stickerId);
  }

  public async unfavoriteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.gateway.unfavoriteSticker(session, packId, stickerId);
  }

  public async markStickerUsed(
    session: Session,
    sticker: StickerMessageReference,
  ): Promise<void> {
    await this.gateway.markStickerUsed(
      session,
      sticker.packId,
      sticker.stickerId,
    );
  }

  public stickerAssetUrl(assetCid: string): string {
    return this.gateway.apiUrl(`/ipfs/${encodeURIComponent(assetCid)}`);
  }

  public async listConversations(
    session: Session,
  ): Promise<ConversationResource[]> {
    return await this.listConversationsUseCase.execute(session);
  }

  public async markConversationReadUntil(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.gateway.markConversationReadUntil(
      session,
      conversationId,
      messageId,
    );
  }

  public async listNodeNetworks(session?: Session): Promise<NodeNetwork[]> {
    return await this.listNodeNetworksUseCase.execute(session);
  }

  public async listNotifications(
    session: Session,
  ): Promise<NotificationResource[]> {
    return await this.listNotificationsUseCase.list(
      new ListNotificationsMessage(session),
    );
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
    options?: { signal?: AbortSignal },
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> {
    return await this.loadMessagesUseCase.execute(
      session,
      conversationId,
      before,
      options,
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
    return await this.updateNotificationUseCase.update(
      new UpdateNotificationMessage({
        notificationId,
        session,
        state,
      }),
    );
  }

  private async createCommunityKeyEntry(
    communityId: string,
  ): Promise<ConversationKeyEntry> {
    const keyPair = await KeyPair.generate();
    const primitives = keyPair.toPrimitives();

    return {
      conversationId: communityId,
      createdAt: Date.now(),
      peerIdentityId: '',
      privateKey: primitives.privateKey,
      publicKey: primitives.publicKey,
    };
  }

  private async createInitialCommunityChannels(
    session: Session,
    communityId: string,
    channels: Array<{ name: string; type: 'text' | 'voice' }>,
  ): Promise<{
    textChannels: CommunityTextChannel[];
    voiceChannels: CommunityVoiceChannel[];
  }> {
    const textChannels = [];
    const voiceChannels = [];

    for (const channel of channels) {
      if (channel.type === 'voice') {
        voiceChannels.push(
          await this.createCommunityVoiceChannel(
            session,
            communityId,
            channel.name,
          ),
        );
      } else {
        textChannels.push(
          await this.createCommunityTextChannel(
            session,
            communityId,
            channel.name,
          ),
        );
      }
    }

    return { textChannels, voiceChannels };
  }
}
