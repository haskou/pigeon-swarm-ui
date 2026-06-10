import { SymmetricKey } from '@haskou/value-objects';

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
} from '../../shared/domain/pigeonResources.types';
import type { CommunityChannelMessageEditInput } from './PigeonCommunitiesApplication/CommunityChannelMessageEditInput';
import type { CommunityChannelMessageInput } from './PigeonCommunitiesApplication/CommunityChannelMessageInput';
import type { CommunityImageCids } from './PigeonCommunitiesApplication/CommunityImageCids';
import type { CreateCommunityInput } from './PigeonCommunitiesApplication/CreateCommunityInput';
import type { CreateCommunityResult } from './PigeonCommunitiesApplication/CreateCommunityResult';

import { ListCommunities } from '../../contexts/communities/application/list-communities/ListCommunities';
import { ListCommunitiesMessage } from '../../contexts/communities/application/list-communities/messages/ListCommunitiesMessage';
import { PigeonApiGateway } from './PigeonApiGateway';

export class PigeonCommunitiesApplication {
  private readonly listCommunitiesUseCase: ListCommunities;

  public constructor(private readonly gateway: PigeonApiGateway) {
    this.listCommunitiesUseCase = new ListCommunities({
      list: async (message) =>
        await gateway.listCommunities(message.getSession()),
    });
  }

  private async uploadCommunityImages(
    session: Session,
    input: CreateCommunityInput,
  ): Promise<CommunityImageCids> {
    const avatarCid = input.avatar
      ? (await this.gateway.uploadPublicFile(session, input.avatar)).cid
      : undefined;
    const bannerCid = input.banner
      ? (await this.gateway.uploadPublicFile(session, input.banner)).cid
      : undefined;

    return {
      ...(avatarCid ? { avatarCid } : {}),
      ...(bannerCid ? { bannerCid } : {}),
    };
  }

  private async createCommunityResource(
    session: Session,
    input: CreateCommunityInput,
    images: CommunityImageCids,
  ): Promise<Community> {
    return await this.gateway.createCommunity(session, {
      autoJoinEnabled: input.autoJoinEnabled,
      ...(images.avatarCid ? { avatar: images.avatarCid } : {}),
      ...(images.bannerCid ? { banner: images.bannerCid } : {}),
      description: input.description,
      discoverable: input.discoverable,
      name: input.name,
      networkId: input.networkId,
      visibility: input.visibility,
    });
  }

  private async createPublicCommunityResult(
    session: Session,
    community: Community,
    channels: CreateCommunityInput['channels'],
  ): Promise<CreateCommunityResult> {
    const initialChannels = await this.createInitialChannels(
      session,
      community.id,
      channels ?? [],
    );

    return {
      community: this.communityWithInitialChannels(community, initialChannels),
      keychain: session.keychain,
      keychainExternalIdentifier: session.keychainExternalIdentifier ?? null,
    };
  }

  private async createPrivateCommunityResult(
    session: Session,
    community: Community,
    channels: CreateCommunityInput['channels'],
  ): Promise<CreateCommunityResult> {
    const keyEntry = await this.createCommunityKeyEntry(community.id);
    const published = await this.gateway.publishKeychain(session, {
      ...session.keychain,
      conversations: {
        ...session.keychain.conversations,
        [community.id]: keyEntry,
      },
    });
    const initialChannels = await this.createInitialChannels(
      {
        ...session,
        keychain: published.keychain,
        keychainExternalIdentifier: published.keychainExternalIdentifier,
      },
      community.id,
      channels ?? [],
    );

    return {
      community: this.communityWithInitialChannels(community, initialChannels),
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }

  private communityWithInitialChannels(
    community: Community,
    initialChannels: {
      textChannels: CommunityTextChannel[];
      voiceChannels: CommunityVoiceChannel[];
    },
  ): Community {
    return {
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
    };
  }

  private async resolvePublicImageCid(
    session: Session,
    value: File | null | string | undefined,
  ): Promise<string | undefined> {
    if (!value) return undefined;

    if (typeof value === 'string') return value;

    return (await this.gateway.uploadPublicFile(session, value)).cid;
  }

  private createCommunityKeyEntry(communityId: string): ConversationKeyEntry {
    return {
      algorithm: 'aes-256-gcm',
      conversationId: communityId,
      createdAt: Date.now(),
      key: SymmetricKey.generate().valueOf(),
      kind: 'community',
      peerIdentityId: '',
      version: 2,
    };
  }

  private async createInitialChannels(
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
          await this.createVoiceChannel(session, communityId, channel.name),
        );
      } else {
        textChannels.push(
          await this.createTextChannel(session, communityId, channel.name),
        );
      }
    }

    return { textChannels, voiceChannels };
  }

  public async list(session: Session): Promise<Community[]> {
    return await this.listCommunitiesUseCase.list(
      new ListCommunitiesMessage(session),
    );
  }

  public async get(session: Session, communityId: string): Promise<Community> {
    return await this.gateway.getCommunity(session, communityId);
  }

  public async listModerationLogs(
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

  public async discover(
    session: Session,
    input: { networkId?: string; query?: string },
  ): Promise<CommunityDiscoveryResource[]> {
    return await this.gateway.discoverCommunities(session, input);
  }

  public async create(
    session: Session,
    input: CreateCommunityInput,
  ): Promise<CreateCommunityResult> {
    const images = await this.uploadCommunityImages(session, input);
    const community = await this.createCommunityResource(
      session,
      input,
      images,
    );
    const visibility = community.visibility ?? input.visibility ?? 'private';

    if (visibility === 'public')
      return await this.createPublicCommunityResult(
        session,
        community,
        input.channels,
      );

    return await this.createPrivateCommunityResult(
      session,
      community,
      input.channels,
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

    return await this.gateway.updateCommunity(session, communityId, {
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
    return await this.gateway.addCommunityMember(
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
    return await this.gateway.banCommunityMember(
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
    return await this.gateway.unbanCommunityMember(
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
    return await this.gateway.kickCommunityMember(
      session,
      communityId,
      identityId,
    );
  }

  public async createJoinRequest(
    session: Session,
    communityId: string,
  ): Promise<CommunityMembershipRequest> {
    return await this.gateway.createCommunityJoinRequest(session, communityId);
  }

  public async listMembershipRequests(
    session: Session,
  ): Promise<CommunityMembershipRequest[]> {
    return await this.gateway.listCommunityMembershipRequests(session);
  }

  public async updateMembershipRequest(
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

  public async leave(
    session: Session,
    communityId: string,
  ): Promise<Community> {
    return await this.gateway.leaveCommunity(session, communityId);
  }

  public async createInvitation(
    session: Session,
    communityId: string,
    recipientIdentityId: string,
  ): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: null | string;
  }> {
    return await this.gateway.createCommunityInvitation(
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
    return await this.gateway.createCommunityInviteLink(
      session,
      communityId,
      input,
    );
  }

  public async getInviteLink(
    inviteToken: string,
  ): Promise<CommunityInviteLinkResource> {
    return await this.gateway.getCommunityInviteLink(inviteToken);
  }

  public async acceptInviteLink(
    session: Session,
    inviteToken: string,
  ): Promise<Community> {
    return await this.gateway.acceptCommunityInviteLink(session, inviteToken);
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
    return await this.gateway.acceptCommunityInviteLinkWithKey(
      session,
      inviteToken,
      keyEntry,
    );
  }

  public async listMembers(
    session: Session,
    communityId: string,
  ): Promise<string[]> {
    return await this.gateway.listCommunityMembers(session, communityId);
  }

  public async listRoles(
    session: Session,
    communityId: string,
  ): Promise<CommunityRoleResource[]> {
    return await this.gateway.listCommunityRoles(session, communityId);
  }

  public async createRole(
    session: Session,
    communityId: string,
    input: { name: string; permissions: CommunityPermission[] },
  ): Promise<CommunityRoleResource> {
    return await this.gateway.createCommunityRole(session, communityId, input);
  }

  public async updateRole(
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

  public async deleteRole(
    session: Session,
    communityId: string,
    roleId: string,
  ): Promise<void> {
    await this.gateway.deleteCommunityRole(session, communityId, roleId);
  }

  public async assignMemberRoles(
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

  public async createTextChannel(
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

  public async createVoiceChannel(
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

  public async listChannels(
    session: Session,
    communityId: string,
  ): Promise<CommunityChannel[]> {
    return await this.gateway.listCommunityChannels(session, communityId);
  }

  public async renameChannel(
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

  public async deleteChannel(
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

  public async updateChannelPermissions(
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

  public async createChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    input: CommunityChannelMessageInput,
  ): Promise<MessageResource> {
    return await this.gateway.createCommunityChannelMessage(
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
    return await this.gateway.listCommunityChannelMessages(
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
    return await this.gateway.listCommunityChannelMessageThread(
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
    return await this.gateway.listCommunityChannelMessagePins(
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
    await this.gateway.pinCommunityChannelMessage(
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
    await this.gateway.unpinCommunityChannelMessage(
      session,
      communityId,
      channelId,
      messageId,
    );
  }

  public async listDrafts(session: Session): Promise<CommunityChannelDraft[]> {
    return await this.gateway.listCommunityDrafts(session);
  }

  public async saveChannelDraft(
    session: Session,
    communityId: string,
    channelId: string,
    content: string,
    updatedAt = Date.now(),
  ): Promise<CommunityChannelDraft> {
    return await this.gateway.saveCommunityChannelDraft(
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
    await this.gateway.deleteCommunityChannelDraft(
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
    return await this.gateway.searchCommunityChannelMessages(
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
    return await this.gateway.searchCommunityMessages(
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
    await this.gateway.deleteCommunityChannelMessage(
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
    return await this.gateway.editCommunityChannelMessage(
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
    await this.gateway.addCommunityChannelMessageReaction(
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
    await this.gateway.removeCommunityChannelMessageReaction(
      session,
      communityId,
      channelId,
      messageId,
      emoji,
    );
  }
}
