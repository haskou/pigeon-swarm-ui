import type { LoginIdentityProgressReporter } from '../../contexts/identities/application/ports/LoginIdentityProgressReporter';
import type {
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
  IdentityPresence,
  LocalKeychain,
  LoginResult,
  MessageResource,
  Session,
  SelectablePresenceStatus,
} from '../../shared/domain/pigeonResources.types';
import type { CommunityChannelMessageEditInput } from './CommunityChannelMessageEditInput';
import type { CommunityChannelMessageInput } from './CommunityChannelMessageInput';

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
  private readonly communities: PigeonCommunitiesApplication;

  private readonly gateway: PigeonApiGateway;

  private readonly realtimeApplication: PigeonRealtimeApplication;

  public readonly attachments: PigeonAttachmentsApplication;

  public readonly calls: PigeonCallsApplication;

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
