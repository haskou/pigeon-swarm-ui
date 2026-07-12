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
  CommunityVoiceChannel,
  ConversationKeyEntry,
  LocalKeychain,
  MessageResource,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { CommunityChannelMessageEditInput } from '../infrastructure/http/CommunityChannelMessageEditInput';
import type { CommunityChannelMessageInput } from '../infrastructure/http/CommunityChannelMessageInput';
import type { AcceptCommunityInviteLinkWithKeyPort } from './accept-community-invite-link-with-key/AcceptCommunityInviteLinkWithKeyPort';
import type { AcceptCommunityInviteLinkPort } from './accept-community-invite-link/AcceptCommunityInviteLinkPort';
import type { CreateCommunityInvitationPort } from './create-community-invitation/CreateCommunityInvitationPort';
import type { CreateCommunityInviteLinkPort } from './create-community-invite-link/CreateCommunityInviteLinkPort';
import type { CreateCommunityInput } from './create-community/CreateCommunityInput';
import type { CreateCommunityPort } from './create-community/CreateCommunityPort';
import type { CreateCommunityResult } from './create-community/CreateCommunityResult';
import type { LeaveCommunityResult } from './create-community/LeaveCommunityResult';
import type { DiscoverCommunitiesPort } from './discover-communities/DiscoverCommunitiesPort';
import type { GetCommunityInviteLinkPort } from './get-community-invite-link/GetCommunityInviteLinkPort';
import type { GetCommunityPort } from './get-community/GetCommunityPort';
import type { LeaveCommunityPort } from './leave-community/LeaveCommunityPort';
import type { ListCommunitiesPort } from './list-communities/ListCommunitiesPort';
import type { ListCommunityModerationLogsPort } from './list-community-moderation-logs/ListCommunityModerationLogsPort';
import type { ManageCommunityChannelDraftsPort } from './manage-community-channel-drafts/ManageCommunityChannelDraftsPort';
import type { ManageCommunityChannelMessagesPort } from './manage-community-channel-messages/ManageCommunityChannelMessagesPort';
import type { ManageCommunityChannelPinsPort } from './manage-community-channel-pins/ManageCommunityChannelPinsPort';
import type { ManageCommunityChannelsPort } from './manage-community-channels/ManageCommunityChannelsPort';
import type { ManageCommunityMembersPort } from './manage-community-members/ManageCommunityMembersPort';
import type { ManageCommunityMembershipRequestsPort } from './manage-community-membership-requests/ManageCommunityMembershipRequestsPort';
import type { ManageCommunityRolesPort } from './manage-community-roles/ManageCommunityRolesPort';
import type { CommunityKeychainPort } from './publish-community-keychain/CommunityKeychainPort';
import type { ReadCommunityChannelMessagesPort } from './read-community-channel-messages/ReadCommunityChannelMessagesPort';
import type { UpdateCommunityPort } from './update-community/UpdateCommunityPort';
import type { CommunityMediaPort } from './upload-community-media/CommunityMediaPort';

import { CreateCommunity } from './create-community/CreateCommunity';
import { CreateCommunityMessage } from './create-community/messages/CreateCommunityMessage';
import { LeaveCommunity } from './leave-community/LeaveCommunity';
import { LeaveCommunityMessage } from './leave-community/messages/LeaveCommunityMessage';
import { ListCommunities } from './list-communities/ListCommunities';
import { ListCommunitiesMessage } from './list-communities/messages/ListCommunitiesMessage';

export class PigeonCommunitiesApplication {
  private readonly channelDrafts: ManageCommunityChannelDraftsPort;

  private readonly channelMessages: ManageCommunityChannelMessagesPort;

  private readonly channelPins: ManageCommunityChannelPinsPort;

  private readonly channels: ManageCommunityChannelsPort;

  private readonly channelReads: ReadCommunityChannelMessagesPort;

  private readonly createCommunityUseCase: CreateCommunity;

  private readonly communityDiscoverer: DiscoverCommunitiesPort;

  private readonly communityGetter: GetCommunityPort;

  private readonly communityUpdater: UpdateCommunityPort;

  private readonly communityInvitationCreator: CreateCommunityInvitationPort;

  private readonly communityInviteLinkAcceptor: AcceptCommunityInviteLinkPort;

  private readonly inviteWithKey: AcceptCommunityInviteLinkWithKeyPort;

  private readonly communityInviteLinkCreator: CreateCommunityInviteLinkPort;

  private readonly communityInviteLinkGetter: GetCommunityInviteLinkPort;

  private readonly keychain: CommunityKeychainPort;

  private readonly listCommunitiesUseCase: ListCommunities;

  private readonly leaveCommunityUseCase: LeaveCommunity;

  private readonly media: CommunityMediaPort;

  private readonly moderationLogs: ListCommunityModerationLogsPort;

  private readonly members: ManageCommunityMembersPort;

  private readonly membershipRequests: ManageCommunityMembershipRequestsPort;

  private readonly roles: ManageCommunityRolesPort;

  public constructor(dependencies: {
    channelDrafts: ManageCommunityChannelDraftsPort;
    channelMessages: ManageCommunityChannelMessagesPort;
    channelPins: ManageCommunityChannelPinsPort;
    channels: ManageCommunityChannelsPort;
    channelReads: ReadCommunityChannelMessagesPort;
    communityCreator: CreateCommunityPort;
    communityDiscoverer: DiscoverCommunitiesPort;
    communityGetter: GetCommunityPort;
    communityUpdater: UpdateCommunityPort;
    communityInvitationCreator: CreateCommunityInvitationPort;
    communityInviteLinkAcceptor: AcceptCommunityInviteLinkPort;
    communityInviteLinkAcceptorWithKey: AcceptCommunityInviteLinkWithKeyPort;
    communityInviteLinkCreator: CreateCommunityInviteLinkPort;
    communityInviteLinkGetter: GetCommunityInviteLinkPort;
    keychain: CommunityKeychainPort;
    leaveCommunity: LeaveCommunityPort;
    listCommunities: ListCommunitiesPort;
    media: CommunityMediaPort;
    members: ManageCommunityMembersPort;
    membershipRequests: ManageCommunityMembershipRequestsPort;
    moderationLogs: ListCommunityModerationLogsPort;
    roles: ManageCommunityRolesPort;
  }) {
    this.channelDrafts = dependencies.channelDrafts;
    this.channelMessages = dependencies.channelMessages;
    this.channelPins = dependencies.channelPins;
    this.channels = dependencies.channels;
    this.channelReads = dependencies.channelReads;
    this.createCommunityUseCase = new CreateCommunity(
      dependencies.communityCreator,
      dependencies.channels,
      dependencies.keychain,
      dependencies.media,
    );
    this.communityDiscoverer = dependencies.communityDiscoverer;
    this.communityGetter = dependencies.communityGetter;
    this.communityUpdater = dependencies.communityUpdater;
    this.communityInvitationCreator = dependencies.communityInvitationCreator;
    this.communityInviteLinkAcceptor = dependencies.communityInviteLinkAcceptor;
    this.inviteWithKey = dependencies.communityInviteLinkAcceptorWithKey;
    this.communityInviteLinkCreator = dependencies.communityInviteLinkCreator;
    this.communityInviteLinkGetter = dependencies.communityInviteLinkGetter;
    this.keychain = dependencies.keychain;
    this.leaveCommunityUseCase = new LeaveCommunity(
      dependencies.leaveCommunity,
      dependencies.keychain,
    );
    this.media = dependencies.media;
    this.members = dependencies.members;
    this.membershipRequests = dependencies.membershipRequests;
    this.moderationLogs = dependencies.moderationLogs;
    this.roles = dependencies.roles;
    this.listCommunitiesUseCase = new ListCommunities({
      list: async (message) => await dependencies.listCommunities.list(message),
    });
  }

  private async resolvePublicImageCid(
    session: Session,
    value: File | null | string | undefined,
  ): Promise<string | undefined> {
    if (!value) return undefined;

    if (typeof value === 'string') return value;

    return (await this.media.uploadPublicFile(session, value)).cid;
  }

  public async list(session: Session): Promise<Community[]> {
    return await this.listCommunitiesUseCase.list(
      new ListCommunitiesMessage(session),
    );
  }

  public async get(session: Session, communityId: string): Promise<Community> {
    return await this.communityGetter.getCommunity(session, communityId);
  }

  public async listModerationLogs(
    session: Session,
    communityId: string,
    input?: { beforeLogId?: string; limit?: number },
  ): Promise<CommunityModerationLogPage> {
    return await this.moderationLogs.listCommunityModerationLogs(
      session,
      communityId,
      input,
    );
  }

  public async discover(
    session: Session,
    input: { networkId?: string; query?: string },
  ): Promise<CommunityDiscoveryResource[]> {
    return await this.communityDiscoverer.discoverCommunities(session, input);
  }

  public async create(
    session: Session,
    input: CreateCommunityInput,
  ): Promise<CreateCommunityResult> {
    return await this.createCommunityUseCase.create(
      new CreateCommunityMessage(session, input),
    );
  }

  public async update(
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
    const avatarCid = await this.resolvePublicImageCid(session, input.avatar);
    const bannerCid = await this.resolvePublicImageCid(session, input.banner);

    return await this.communityUpdater.updateCommunity(session, communityId, {
      autoJoinEnabled: input.autoJoinEnabled,
      ...(avatarCid ? { avatar: avatarCid } : {}),
      ...(bannerCid ? { banner: bannerCid } : {}),
      description: input.description,
      discoverable: input.discoverable,
      name: input.name,
    });
  }

  public async addMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<CommunityMembershipRequest> {
    return await this.members.addCommunityMember(
      session,
      communityId,
      identityId,
    );
  }

  public async banMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community> {
    return await this.members.banCommunityMember(
      session,
      communityId,
      identityId,
    );
  }

  public async unbanMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community> {
    return await this.members.unbanCommunityMember(
      session,
      communityId,
      identityId,
    );
  }

  public async kickMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community> {
    return await this.members.kickCommunityMember(
      session,
      communityId,
      identityId,
    );
  }

  public async createJoinRequest(
    session: Session,
    communityId: string,
  ): Promise<CommunityMembershipRequest> {
    return await this.membershipRequests.createCommunityJoinRequest(
      session,
      communityId,
    );
  }

  public async listMembershipRequests(
    session: Session,
  ): Promise<CommunityMembershipRequest[]> {
    return await this.membershipRequests.listCommunityMembershipRequests(
      session,
    );
  }

  public async updateMembershipRequest(
    session: Session,
    requestId: string,
    status: Extract<CommunityMembershipRequestStatus, 'accepted' | 'declined'>,
  ): Promise<CommunityMembershipRequest> {
    return await this.membershipRequests.updateCommunityMembershipRequest(
      session,
      requestId,
      status,
    );
  }

  public async leave(
    session: Session,
    communityId: string,
  ): Promise<LeaveCommunityResult> {
    return await this.leaveCommunityUseCase.leave(
      new LeaveCommunityMessage(session, communityId),
    );
  }

  public async createInvitation(
    session: Session,
    communityId: string,
    recipientIdentityId: string,
  ): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: null | string;
  }> {
    return await this.communityInvitationCreator.createCommunityInvitation(
      session,
      communityId,
      recipientIdentityId,
    );
  }

  public async createInviteLink(
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
    return await this.communityInviteLinkCreator.createCommunityInviteLink(
      session,
      communityId,
      input,
    );
  }

  public async getInviteLink(
    inviteToken: string,
  ): Promise<CommunityInviteLinkResource> {
    return await this.communityInviteLinkGetter.getCommunityInviteLink(
      inviteToken,
    );
  }

  public async acceptInviteLink(
    session: Session,
    inviteToken: string,
  ): Promise<Community> {
    return await this.communityInviteLinkAcceptor.acceptCommunityInviteLink(
      session,
      inviteToken,
    );
  }

  public async acceptInviteLinkWithKey(
    session: Session,
    inviteToken: string,
    keyEntry: ConversationKeyEntry,
  ): Promise<{
    community: Community;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    return await this.inviteWithKey.acceptCommunityInviteLinkWithKey(
      session,
      inviteToken,
      keyEntry,
    );
  }

  public async listMembers(
    session: Session,
    communityId: string,
  ): Promise<string[]> {
    return await this.members.listCommunityMembers(session, communityId);
  }

  public async listRoles(
    session: Session,
    communityId: string,
  ): Promise<CommunityRoleResource[]> {
    return await this.roles.listCommunityRoles(session, communityId);
  }

  public async createRole(
    session: Session,
    communityId: string,
    input: { name: string; permissions: CommunityPermission[] },
  ): Promise<CommunityRoleResource> {
    return await this.roles.createCommunityRole(session, communityId, input);
  }

  public async updateRole(
    session: Session,
    communityId: string,
    roleId: string,
    input: { name: string; permissions: CommunityPermission[] },
  ): Promise<CommunityRoleResource> {
    return await this.roles.updateCommunityRole(
      session,
      communityId,
      roleId,
      input,
    );
  }

  public async deleteRole(
    session: Session,
    communityId: string,
    roleId: string,
  ): Promise<void> {
    await this.roles.deleteCommunityRole(session, communityId, roleId);
  }

  public async assignMemberRoles(
    session: Session,
    communityId: string,
    identityId: string,
    roleIds: string[],
  ): Promise<Community> {
    return await this.roles.assignCommunityMemberRoles(
      session,
      communityId,
      identityId,
      roleIds,
    );
  }

  public async createTextChannel(
    session: Session,
    communityId: string,
    name: string,
  ): Promise<CommunityTextChannel> {
    return await this.channels.createCommunityTextChannel(
      session,
      communityId,
      name,
    );
  }

  public async createVoiceChannel(
    session: Session,
    communityId: string,
    name: string,
  ): Promise<CommunityVoiceChannel> {
    return await this.channels.createCommunityVoiceChannel(
      session,
      communityId,
      name,
    );
  }

  public async listChannels(
    session: Session,
    communityId: string,
  ): Promise<CommunityChannel[]> {
    return await this.channels.listCommunityChannels(session, communityId);
  }

  public async renameChannel(
    session: Session,
    communityId: string,
    channelId: string,
    name: string,
  ): Promise<CommunityChannel> {
    return await this.channels.renameCommunityChannel(
      session,
      communityId,
      channelId,
      name,
    );
  }

  public async deleteChannel(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<Community> {
    return await this.channels.deleteCommunityChannel(
      session,
      communityId,
      channelId,
    );
  }

  public async updateChannelPermissions(
    session: Session,
    communityId: string,
    channelId: string,
    visibleRoleIds: string[],
  ): Promise<CommunityChannel> {
    return await this.channels.updateCommunityChannelPermissions(
      session,
      communityId,
      channelId,
      visibleRoleIds,
    );
  }

  public async createChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    input: CommunityChannelMessageInput,
  ): Promise<MessageResource> {
    return await this.channelMessages.createCommunityChannelMessage(
      session,
      communityId,
      channelId,
      input,
    );
  }

  public async listChannelMessages(
    session: Session,
    communityId: string,
    channelId: string,
    options: { beforeMessageId?: string; limit?: number } = {},
  ): Promise<{
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }> {
    return await this.channelReads.listCommunityChannelMessages(
      session,
      communityId,
      channelId,
      options,
    );
  }

  public async listChannelMessageThread(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    options: { limit?: number } = {},
  ): Promise<{
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }> {
    return await this.channelReads.listCommunityChannelMessageThread(
      session,
      communityId,
      channelId,
      messageId,
      options,
    );
  }

  public async listChannelMessagePins(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<CommunityChannelMessagePinsResource> {
    return await this.channelReads.listCommunityChannelMessagePins(
      session,
      communityId,
      channelId,
    );
  }

  public async pinChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
  ): Promise<void> {
    await this.channelPins.pinCommunityChannelMessage(
      session,
      communityId,
      channelId,
      messageId,
    );
  }

  public async unpinChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
  ): Promise<void> {
    await this.channelPins.unpinCommunityChannelMessage(
      session,
      communityId,
      channelId,
      messageId,
    );
  }

  public async listDrafts(session: Session): Promise<CommunityChannelDraft[]> {
    return await this.channelReads.listCommunityDrafts(session);
  }

  public async saveChannelDraft(
    session: Session,
    communityId: string,
    channelId: string,
    content: string,
    updatedAt = Date.now(),
  ): Promise<CommunityChannelDraft> {
    return await this.channelDrafts.saveCommunityChannelDraft(
      session,
      communityId,
      channelId,
      content,
      updatedAt,
    );
  }

  public async deleteChannelDraft(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<void> {
    await this.channelDrafts.deleteCommunityChannelDraft(
      session,
      communityId,
      channelId,
    );
  }

  public async searchChannelMessages(
    session: Session,
    communityId: string,
    channelId: string,
    input: { limit?: number; query: string },
  ): Promise<{
    channelId?: string;
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }> {
    return await this.channelReads.searchCommunityChannelMessages(
      session,
      communityId,
      channelId,
      input,
    );
  }

  public async searchMessages(
    session: Session,
    communityId: string,
    input: { limit?: number; query: string },
  ): Promise<{
    channelId?: string;
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }> {
    return await this.channelReads.searchCommunityMessages(
      session,
      communityId,
      input,
    );
  }

  public async deleteChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
  ): Promise<void> {
    await this.channelMessages.deleteCommunityChannelMessage(
      session,
      communityId,
      channelId,
      messageId,
    );
  }

  public async editChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    input: CommunityChannelMessageEditInput,
  ): Promise<MessageResource> {
    return await this.channelMessages.editCommunityChannelMessage(
      session,
      communityId,
      channelId,
      messageId,
      input,
    );
  }

  public async addChannelMessageReaction(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.channelMessages.addCommunityChannelMessageReaction(
      session,
      communityId,
      channelId,
      messageId,
      emoji,
    );
  }

  public async removeChannelMessageReaction(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.channelMessages.removeCommunityChannelMessageReaction(
      session,
      communityId,
      channelId,
      messageId,
      emoji,
    );
  }
}
