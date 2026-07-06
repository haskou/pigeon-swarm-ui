import type {
  CallIceServerConfig,
  CallResource,
  CallSignalPayload,
} from '../../contexts/calls/domain/callSession.types';
import type { LoginIdentityProgressReporter } from '../../contexts/identities/application/ports/LoginIdentityProgressReporter';
import type { IdentityUpdateProfileInput } from '../../contexts/identities/domain/IdentitySignaturePayloadFactory';
import type { NodeRelayConfiguration } from '../../contexts/networks/application/configure-node-relay/NodeRelayConfiguration';
import type { NodeRelayPortCheckResource } from '../../contexts/networks/application/configure-node-relay/NodeRelayPortCheckResource';
import type { NodeRelayPortCheckTarget } from '../../contexts/networks/application/configure-node-relay/NodeRelayPortCheckTarget';
import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  ChatMessage,
  Community,
  CommunityChannel,
  CommunityChannelDraft,
  CommunityChannelMessagePinsResource,
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
  ConversationKeyEntry,
  ConversationDraft,
  ConversationResource,
  CreatePollInput,
  EditMessageOptions,
  IdentityResource,
  IdentityPresence,
  IpfsReplicationStatus,
  LocalKeychain,
  LoginResult,
  MessageLinkPreview,
  MessageAttachment,
  MessagePin,
  MessageResource,
  MyStickersResource,
  NotificationScopeSetting,
  NotificationScopeSettingInput,
  NotificationSettingScope,
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
import type { CommunityChannelMessageEditInput } from './CommunityChannelMessageEditInput';
import type { CommunityChannelMessageInput } from './CommunityChannelMessageInput';

import { PublishMessageAttachmentsMessage } from '../../contexts/attachments/application/publish-message-attachments/messages/PublishMessageAttachmentsMessage';
import { PublishMessageAttachments } from '../../contexts/attachments/application/publish-message-attachments/PublishMessageAttachments';
import { CreateConversation } from '../../contexts/conversations/application/create-conversation/CreateConversation';
import { CreateConversationMessage } from '../../contexts/conversations/application/create-conversation/messages/CreateConversationMessage';
import {
  CreateGroupConversation,
  type CreateGroupConversationInput,
} from '../../contexts/conversations/application/create-group-conversation/CreateGroupConversation';
import { CreateGroupConversationMessage } from '../../contexts/conversations/application/create-group-conversation/messages/CreateGroupConversationMessage';
import { ListConversations } from '../../contexts/conversations/application/list-conversations/ListConversations';
import { ListConversationsMessage } from '../../contexts/conversations/application/list-conversations/messages/ListConversationsMessage';
import { ConversationTimeline } from '../../contexts/conversations/domain/ConversationTimeline';
import { LoginIdentity } from '../../contexts/identities/application/login-identity/LoginIdentity';
import { LoginIdentityMessage } from '../../contexts/identities/application/login-identity/messages/LoginIdentityMessage';
import { RegisterIdentityMessage } from '../../contexts/identities/application/register-identity/messages/RegisterIdentityMessage';
import { RegisterIdentity } from '../../contexts/identities/application/register-identity/RegisterIdentity';
import { AddMessageReaction } from '../../contexts/messages/application/add-message-reaction/AddMessageReaction';
import { AddMessageReactionMessage } from '../../contexts/messages/application/add-message-reaction/messages/AddMessageReactionMessage';
import { DeleteMessage } from '../../contexts/messages/application/delete-message/DeleteMessage';
import { DeleteMessageMessage } from '../../contexts/messages/application/delete-message/messages/DeleteMessageMessage';
import { EditMessage } from '../../contexts/messages/application/edit-message/EditMessage';
import { EditMessageMessage } from '../../contexts/messages/application/edit-message/messages/EditMessageMessage';
import { LoadMessage } from '../../contexts/messages/application/load-message/LoadMessage';
import { LoadMessageMessage } from '../../contexts/messages/application/load-message/messages/LoadMessageMessage';
import { LoadMessagesAround } from '../../contexts/messages/application/load-messages-around/LoadMessagesAround';
import { LoadMessagesAroundMessage } from '../../contexts/messages/application/load-messages-around/messages/LoadMessagesAroundMessage';
import { LoadMessages } from '../../contexts/messages/application/load-messages/LoadMessages';
import { LoadMessagesMessage } from '../../contexts/messages/application/load-messages/messages/LoadMessagesMessage';
import { RemoveMessageReactionMessage } from '../../contexts/messages/application/remove-message-reaction/messages/RemoveMessageReactionMessage';
import { RemoveMessageReaction } from '../../contexts/messages/application/remove-message-reaction/RemoveMessageReaction';
import { SendMessageMessage } from '../../contexts/messages/application/send-message/messages/SendMessageMessage';
import { SendMessage } from '../../contexts/messages/application/send-message/SendMessage';
import { CreateNetwork } from '../../contexts/networks/application/create-network/CreateNetwork';
import { CreateNetworkMessage } from '../../contexts/networks/application/create-network/messages/CreateNetworkMessage';
import { CreatePublicNetwork } from '../../contexts/networks/application/create-public-network/CreatePublicNetwork';
import { CreatePublicNetworkMessage } from '../../contexts/networks/application/create-public-network/messages/CreatePublicNetworkMessage';
import { JoinNetwork } from '../../contexts/networks/application/join-network/JoinNetwork';
import { JoinNetworkMessage } from '../../contexts/networks/application/join-network/messages/JoinNetworkMessage';
import {
  ListNodeNetworks,
  type NodeNetwork,
} from '../../contexts/networks/application/list-node-networks/ListNodeNetworks';
import { ListNodeNetworksMessage } from '../../contexts/networks/application/list-node-networks/messages/ListNodeNetworksMessage';
import {
  ListPeers,
  type Peer,
} from '../../contexts/networks/application/list-peers/ListPeers';
import { ListPeersMessage } from '../../contexts/networks/application/list-peers/messages/ListPeersMessage';
import { RemoveNodeNetworkMessage } from '../../contexts/networks/application/remove-node-network/messages/RemoveNodeNetworkMessage';
import { RemoveNodeNetwork } from '../../contexts/networks/application/remove-node-network/RemoveNodeNetwork';
import { AcceptConversationInvitation } from '../../contexts/notifications/application/accept-conversation-invitation/AcceptConversationInvitation';
import { AcceptConversationInvitationMessage } from '../../contexts/notifications/application/accept-conversation-invitation/messages/AcceptConversationInvitationMessage';
import { ListNotificationSettings } from '../../contexts/notifications/application/list-notification-settings/ListNotificationSettings';
import { ListNotificationSettingsMessage } from '../../contexts/notifications/application/list-notification-settings/messages/ListNotificationSettingsMessage';
import { ListNotifications } from '../../contexts/notifications/application/list-notifications/ListNotifications';
import { ListNotificationsMessage } from '../../contexts/notifications/application/list-notifications/messages/ListNotificationsMessage';
import { ResetNotificationSettingMessage } from '../../contexts/notifications/application/reset-notification-setting/messages/ResetNotificationSettingMessage';
import { ResetNotificationSetting } from '../../contexts/notifications/application/reset-notification-setting/ResetNotificationSetting';
import { SaveNotificationSettingMessage } from '../../contexts/notifications/application/save-notification-setting/messages/SaveNotificationSettingMessage';
import { SaveNotificationSetting } from '../../contexts/notifications/application/save-notification-setting/SaveNotificationSetting';
import { UpdateNotificationMessage } from '../../contexts/notifications/application/update-notification/messages/UpdateNotificationMessage';
import { UpdateNotification } from '../../contexts/notifications/application/update-notification/UpdateNotification';
import { VotePollMessage } from '../../contexts/polls/application/vote-poll/messages/VotePollMessage';
import { VotePoll } from '../../contexts/polls/application/vote-poll/VotePoll';
import { ListStickerPacks } from '../../contexts/stickers/application/list-sticker-packs/ListStickerPacks';
import { ListStickerPacksMessage } from '../../contexts/stickers/application/list-sticker-packs/messages/ListStickerPacksMessage';
import {
  RealtimeGateway,
  type RealtimeHeartbeatActivityMode,
  type RealtimeMessage,
  type RealtimeTypingInput,
} from '../../shared/infrastructure/realtime/RealtimeGateway';
import { PigeonApiGateway } from './PigeonApiGateway';
import { PigeonCallsApplication } from './PigeonCallsApplication';
import { PigeonCommunitiesApplication } from './PigeonCommunitiesApplication';
import { PigeonRealtimeApplication } from './PigeonRealtimeApplication';

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
  private readonly calls: PigeonCallsApplication;

  private readonly communities: PigeonCommunitiesApplication;

  private readonly gateway: PigeonApiGateway;

  private readonly realtimeApplication: PigeonRealtimeApplication;

  private readonly acceptInvitationUseCase: AcceptConversationInvitation;

  private readonly createConversationUseCase: CreateConversation;

  private readonly createGroupConversationUseCase: CreateGroupConversation;

  private readonly createNetworkUseCase: CreateNetwork;

  private readonly createPublicNetworkUseCase: CreatePublicNetwork;

  private readonly joinNetworkUseCase: JoinNetwork;

  private readonly removeNodeNetworkUseCase: RemoveNodeNetwork;

  private readonly deleteMessageUseCase: DeleteMessage;

  private readonly editMessageUseCase: EditMessage;

  private readonly addMessageReactionUseCase: AddMessageReaction;

  private readonly listConversationsUseCase: ListConversations;

  private readonly listNodeNetworksUseCase: ListNodeNetworks;

  private readonly listNotificationsUseCase: ListNotifications;

  private readonly listNotificationSettingsUseCase: ListNotificationSettings;

  private readonly listPeersUseCase: ListPeers;

  private readonly listStickerPacksUseCase: ListStickerPacks;

  private readonly loadMessagesUseCase: LoadMessages;

  private readonly loadMessageUseCase: LoadMessage;

  private readonly loadMessagesAroundUseCase: LoadMessagesAround;

  private readonly loginIdentityUseCase: LoginIdentity;

  private readonly registerIdentityUseCase: RegisterIdentity;

  private readonly removeMessageReactionUseCase: RemoveMessageReaction;

  private readonly sendMessageUseCase: SendMessage;

  private readonly publishMessageAttachmentsUseCase: PublishMessageAttachments;

  private readonly votePollUseCase: VotePoll;

  private readonly updateNotificationUseCase: UpdateNotification;

  private readonly resetNotificationSettingUseCase: ResetNotificationSetting;

  private readonly saveNotificationSettingUseCase: SaveNotificationSetting;

  public constructor(
    gateway: PigeonApiGateway = new PigeonApiGateway(),
    realtime: RealtimeGateway = new RealtimeGateway(),
  ) {
    this.gateway = gateway;
    this.calls = new PigeonCallsApplication(gateway);
    this.communities = new PigeonCommunitiesApplication(gateway);
    this.realtimeApplication = new PigeonRealtimeApplication(realtime);
    this.acceptInvitationUseCase = new AcceptConversationInvitation(gateway);
    this.createConversationUseCase = new CreateConversation(gateway);
    this.createGroupConversationUseCase = new CreateGroupConversation(gateway);
    this.createNetworkUseCase = new CreateNetwork({
      create: async (name) => await gateway.createNetwork(name.toString()),
    });
    this.createPublicNetworkUseCase = new CreatePublicNetwork({
      createPublic: async (session) =>
        await gateway.createPublicNetwork(session),
    });
    this.addMessageReactionUseCase = new AddMessageReaction(gateway);
    this.deleteMessageUseCase = new DeleteMessage(gateway);
    this.editMessageUseCase = new EditMessage(gateway);
    this.joinNetworkUseCase = new JoinNetwork({
      joinNetwork: async (id, name, key) =>
        await gateway.joinNetwork(
          id.toString(),
          name.toString(),
          key.toString(),
        ),
    });
    this.removeNodeNetworkUseCase = new RemoveNodeNetwork({
      remove: async (networkId, session) =>
        await gateway.removeNetwork(networkId.toString(), session),
    });
    this.listNotificationSettingsUseCase = new ListNotificationSettings({
      listNotificationSettings: async (session) =>
        await gateway.listNotificationSettings(session),
    });
    this.listConversationsUseCase = new ListConversations(gateway);
    this.listNodeNetworksUseCase = new ListNodeNetworks(gateway);
    this.listNotificationsUseCase = new ListNotifications(gateway);
    this.listPeersUseCase = new ListPeers(gateway);
    this.listStickerPacksUseCase = new ListStickerPacks({
      list: async (message) =>
        await gateway.listStickerPacks({
          ownerIdentityId: message.getOwnerIdentityId(),
        }),
    });
    this.loadMessageUseCase = new LoadMessage(gateway);
    this.loadMessagesAroundUseCase = new LoadMessagesAround(gateway);
    this.loadMessagesUseCase = new LoadMessages(gateway);
    this.loginIdentityUseCase = new LoginIdentity(gateway);
    this.publishMessageAttachmentsUseCase = new PublishMessageAttachments({
      publish: async (message) =>
        await gateway.publishMessageAttachments(
          message.getSession(),
          message.getAttachments(),
          message.getProgressReporter(),
          message.getOptions(),
        ),
    });
    this.registerIdentityUseCase = new RegisterIdentity({
      register: async (name, password, networks, handle, options) =>
        await gateway.register(
          name.toString(),
          password,
          networks.toPrimitives(),
          handle?.toString(),
          options,
        ),
    });
    this.removeMessageReactionUseCase = new RemoveMessageReaction(gateway);
    this.resetNotificationSettingUseCase = new ResetNotificationSetting({
      resetNotificationSetting: async (session, scope) =>
        await gateway.resetNotificationSetting(session, scope),
    });
    this.saveNotificationSettingUseCase = new SaveNotificationSetting({
      saveNotificationSetting: async (session, setting) =>
        await gateway.saveNotificationSetting(session, setting),
    });
    this.sendMessageUseCase = new SendMessage(gateway);
    this.votePollUseCase = new VotePoll({
      vote: async (message) =>
        await gateway.votePoll(
          message.getSession(),
          message.getPollId().toString(),
          message.getOptionIds().map((optionId) => optionId.toString()),
        ),
    });
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
    return await this.calls.list(session);
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
    return await this.calls.startConversation(session, conversationId);
  }

  public async startCommunityChannelCall(
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

  public async joinCall(
    session: Session,
    callId: string,
  ): Promise<CallResource> {
    return await this.calls.join(session, callId);
  }

  public async leaveCall(session: Session, callId: string): Promise<void> {
    await this.calls.leave(session, callId);
  }

  public async heartbeatCallParticipant(
    session: Session,
    callId: string,
  ): Promise<void> {
    await this.calls.heartbeatParticipant(session, callId);
  }

  public async endCall(session: Session, callId: string): Promise<void> {
    await this.calls.end(session, callId);
  }

  public async sendCallSignal(
    session: Session,
    callId: string,
    signal: CallSignalPayload,
  ): Promise<void> {
    await this.calls.sendSignal(session, callId, signal);
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
    return await this.createConversationUseCase.create(
      new CreateConversationMessage({ networkId, peerIdentityId, session }),
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
    return await this.createGroupConversationUseCase.create(
      new CreateGroupConversationMessage({ group: input, session }),
    );
  }

  public async createNetwork(name: string): Promise<void> {
    await this.createNetworkUseCase.create(new CreateNetworkMessage(name));
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
      avatar?: File | null;
      banner?: File | null;
      channels?: Array<{ name: string; type: 'text' | 'voice' }>;
      description: string;
      discoverable?: boolean | undefined;
      name: string;
      networkId: string;
      visibility?: CommunityVisibility;
    },
  ): Promise<{
    community: Community;
    keychain: LocalKeychain;
    keychainExternalIdentifier: null | string;
  }> {
    return await this.communities.create(session, input);
  }

  public async updateCommunity(
    session: Session,
    communityId: string,
    input: {
      autoJoinEnabled?: boolean | undefined;
      avatar?: File | null | string;
      banner?: File | null | string;
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
    return await this.communities.addMember(session, communityId, identityId);
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
    return await this.communities.createJoinRequest(session, communityId);
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
    return await this.communities.updateMembershipRequest(
      session,
      requestId,
      status,
    );
  }

  public async leaveCommunity(
    session: Session,
    communityId: string,
  ): Promise<{
    community: Community | null;
    communityId: string;
    keychain: LocalKeychain;
    keychainExternalIdentifier: null | string;
  }> {
    return await this.communities.leave(session, communityId);
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
    keychainExternalIdentifier: null | string;
  }> {
    return await this.communities.createInvitation(
      session,
      communityId,
      recipientIdentityId,
    );
  }

  public async createCommunityInviteLink(
    session: Session,
    communityId: string,
    input: { expiresAt?: number; maxUses?: number } = {},
  ): Promise<{
    invite: CommunityInviteLinkResource;
    inviteSecret?: string;
    keyEntry?: ConversationKeyEntry;
    keychain: LocalKeychain;
    keychainExternalIdentifier: null | string;
  }> {
    return await this.communities.createInviteLink(session, communityId, input);
  }

  public async getCommunityInviteLink(
    inviteToken: string,
  ): Promise<CommunityInviteLinkResource> {
    return await this.communities.getInviteLink(inviteToken);
  }

  public async acceptCommunityInviteLink(
    session: Session,
    inviteToken: string,
  ): Promise<Community> {
    return await this.communities.acceptInviteLink(session, inviteToken);
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
    return await this.communities.acceptInviteLinkWithKey(
      session,
      inviteToken,
      keyEntry,
    );
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
    return await this.communities.saveChannelDraft(
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
    await this.communities.deleteChannelDraft(session, communityId, channelId);
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
    return await this.communities.searchMessages(session, communityId, input);
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

  public async publishMessageAttachments(
    session: Session,
    attachments: File[],
    onProgress?: (progress: AttachmentProgress) => void,
    options?: AttachmentUploadOptions,
  ): Promise<MessageAttachment[]> {
    return await this.publishMessageAttachmentsUseCase.publish(
      new PublishMessageAttachmentsMessage({
        attachments,
        onProgress,
        options,
        session,
      }),
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
    return await this.votePollUseCase.vote(
      new VotePollMessage({ optionIds, pollId, session }),
    );
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

  public async createPublicNodeNetwork(session?: Session): Promise<void> {
    await this.createPublicNetworkUseCase.create(
      new CreatePublicNetworkMessage(session),
    );
  }

  public async joinNetwork(
    id: string,
    name: string,
    key: string,
  ): Promise<void> {
    await this.joinNetworkUseCase.join(
      new JoinNetworkMessage({ id, key, name }),
    );
  }

  public async joinNodeNetwork(
    session: Session,
    id: string,
    name: string,
    key: string,
  ): Promise<void> {
    await this.gateway.joinNetwork(id, name, key, session);
  }

  public async removeNodeNetwork(
    networkId: string,
    session?: Session,
  ): Promise<NodeNetwork[]> {
    return await this.removeNodeNetworkUseCase.remove(
      new RemoveNodeNetworkMessage({ networkId, session }),
    );
  }

  public async getNodeRelayConfiguration(
    session: Session,
  ): Promise<NodeRelayConfiguration> {
    return await this.gateway.getNodeRelayConfiguration(session);
  }

  public async updateNodeRelayConfiguration(
    configuration: NodeRelayConfiguration,
    session?: Session,
  ): Promise<NodeRelayConfiguration> {
    return await this.gateway.updateNodeRelayConfiguration(
      configuration,
      session,
    );
  }

  public async checkNodeRelayPorts(
    publicHost: string,
    checks: NodeRelayPortCheckTarget[],
    session: Session,
  ): Promise<NodeRelayPortCheckResource> {
    return await this.gateway.checkNodeRelayPorts(publicHost, checks, session);
  }

  public async getNodeInfo(): Promise<{ id: string; owner: string | null }> {
    return await this.gateway.getNodeInfo();
  }

  public async getIdentity(identityId: string): Promise<IdentityResource> {
    return await this.gateway.getIdentity(identityId);
  }

  public async refreshIdentity(identityId: string): Promise<IdentityResource> {
    return await this.gateway.refreshIdentity(identityId);
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
    await this.deleteMessageUseCase.delete(
      new DeleteMessageMessage({ conversationId, messageId, session }),
    );
  }

  public async editMessage(
    session: Session,
    conversationId: string,
    messageId: string,
    content: string,
    options: EditMessageOptions = {},
  ): Promise<ChatMessage> {
    return await this.editMessageUseCase.edit(
      new EditMessageMessage({
        content,
        conversationId,
        messageId,
        options,
        session,
      }),
    );
  }

  public async addMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.addMessageReactionUseCase.add(
      new AddMessageReactionMessage({
        conversationId,
        emoji,
        messageId,
        session,
      }),
    );
  }

  public async removeMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.removeMessageReactionUseCase.remove(
      new RemoveMessageReactionMessage({
        conversationId,
        emoji,
        messageId,
        session,
      }),
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
    return await this.gateway.updateIdentityProfile(
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
    await this.gateway.configureLocalPasskeyUnlock(
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
    return await this.listStickerPacksUseCase.list(
      new ListStickerPacksMessage(input),
    );
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
    return await this.listConversationsUseCase.list(
      new ListConversationsMessage(session),
    );
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
    return await this.listNodeNetworksUseCase.list(
      new ListNodeNetworksMessage(session),
    );
  }

  public async listNotifications(
    session: Session,
  ): Promise<NotificationResource[]> {
    return await this.listNotificationsUseCase.list(
      new ListNotificationsMessage(session),
    );
  }

  public async listNotificationSettings(
    session: Session,
  ): Promise<NotificationScopeSetting[]> {
    return await this.listNotificationSettingsUseCase.list(
      new ListNotificationSettingsMessage(session),
    );
  }

  public async listPeers(): Promise<Peer[]> {
    return await this.listPeersUseCase.list(new ListPeersMessage());
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
    options?: { limit?: number; signal?: AbortSignal },
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> {
    return await this.loadMessagesUseCase.load(
      new LoadMessagesMessage({
        before,
        conversationId,
        options,
        session,
      }),
    );
  }

  public async loadMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<ChatMessage | null> {
    return await this.loadMessageUseCase.load(
      new LoadMessageMessage({ conversationId, messageId, session }),
    );
  }

  public async decryptMessageResource(
    session: Session,
    conversationId: string,
    message: MessageResource,
  ): Promise<ChatMessage> {
    return await this.gateway.decryptMessage(session, conversationId, message);
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
    return await this.loadMessagesAroundUseCase.loadAround(
      new LoadMessagesAroundMessage({ conversationId, messageId, session }),
    );
  }

  public async loadMessageThread(
    session: Session,
    conversationId: string,
    messageId: string,
    options: { limit?: number } = {},
  ): Promise<{ messages: ChatMessage[]; nextBeforeMessageId?: null | string }> {
    return await this.gateway.loadMessageThread(
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
    return await this.gateway.listMessagePins(session, conversationId);
  }

  public async pinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.gateway.pinMessage(session, conversationId, messageId);
  }

  public async unpinMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.gateway.unpinMessage(session, conversationId, messageId);
  }

  public async listConversationDrafts(
    session: Session,
  ): Promise<ConversationDraft[]> {
    return await this.gateway.listConversationDrafts(session);
  }

  public async saveConversationDraft(
    session: Session,
    conversationId: string,
    content: string,
    updatedAt = Date.now(),
  ): Promise<ConversationDraft> {
    return await this.gateway.saveConversationDraft(
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
    await this.gateway.deleteConversationDraft(session, conversationId);
  }

  public async login(
    identityId: string,
    password: string,
    onProgress?: LoginIdentityProgressReporter,
    recoveryKey?: string,
  ): Promise<LoginResult> {
    return await this.loginIdentityUseCase.login(
      new LoginIdentityMessage({
        identityId,
        onProgress,
        password,
        recoveryKey,
      }),
    );
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

  public async register(
    name: string,
    password: string,
    networks: string[],
    handle?: string,
    options: { passkeyPrfEnabled?: boolean; recoveryKey?: string } = {},
  ): Promise<LoginResult> {
    return await this.registerIdentityUseCase.register(
      new RegisterIdentityMessage({
        handle,
        name,
        networks,
        passkeyPrfEnabled: options.passkeyPrfEnabled,
        password,
        recoveryKey: options.recoveryKey,
      }),
    );
  }

  public async sendMessage(
    session: Session,
    conversationId: string,
    content: string,
    options: SendMessageOptions = {},
  ): Promise<ChatMessage> {
    return await this.sendMessageUseCase.send(
      new SendMessageMessage({
        content,
        conversationId,
        options,
        session,
      }),
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

  public async saveNotificationSetting(
    session: Session,
    setting: NotificationScopeSettingInput,
  ): Promise<NotificationScopeSetting> {
    return await this.saveNotificationSettingUseCase.save(
      new SaveNotificationSettingMessage({ session, setting }),
    );
  }

  public async resetNotificationSetting(
    session: Session,
    scope: NotificationSettingScope,
  ): Promise<void> {
    await this.resetNotificationSettingUseCase.reset(
      new ResetNotificationSettingMessage({ scope, session }),
    );
  }
}
