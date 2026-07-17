import type {
  Community,
  CommunityChannel,
  CommunityChannelDraft,
  CommunityChannelMessagePinsResource,
  CommunityDiscoveryResource,
  CommunityInviteLinkResource,
  CommunityMembershipRequest,
  CommunityModerationLogPage,
  CommunityPermission,
  CommunityRoleResource,
  CommunityTextChannel,
  CommunityVoiceChannel,
  ConversationKeyEntry,
  LocalKeychain,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { PigeonFilesGateway } from '../../../attachments/infrastructure/http/PigeonFilesGateway';
import type { CommunityChannelMessageEditInput } from './CommunityChannelMessageEditInput';
import type { CommunityChannelMessageInput } from './CommunityChannelMessageInput';
import type { CommunityInviteLinkInput } from './CommunityInviteLinkInput';
import type { PigeonCommunitiesApi } from './PigeonCommunitiesApi';
import type { PigeonCommunityInvitationApi } from './PigeonCommunityInvitationApi';

import { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';

export class PigeonCommunitiesGateway {
  public constructor(
    private readonly communities: PigeonCommunitiesApi,
    private readonly invitations: PigeonCommunityInvitationApi,
    private readonly requestCache: RequestCache,
    private readonly media: Pick<PigeonFilesGateway, 'uploadPublicFile'>,
  ) {}

  private invalidateChannelPins(
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

  public async uploadPublicFile(
    session: Session,
    file: File,
  ): Promise<{ cid: string }> {
    return await this.media.uploadPublicFile(session, file);
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
      autoJoinEnabled?: boolean;
      avatar?: string;
      banner?: string;
      description: string;
      discoverable?: boolean;
      name: string;
      networkId: string;
      visibility?: 'private' | 'public';
    },
  ): Promise<Community> {
    return await this.communities.create(session, input);
  }

  public async updateCommunity(
    session: Session,
    communityId: string,
    input: {
      autoJoinEnabled?: boolean;
      avatar?: string;
      banner?: string;
      description?: string;
      discoverable?: boolean;
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
    status: Extract<
      CommunityMembershipRequest['status'],
      'accepted' | 'declined'
    >,
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
        const community = await this.communities.get(
          session,
          request.communityId,
        );

        if (community.visibility === 'public') return request;
      }

      await this.invitations.notifyMember(
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
    this.invalidateChannelPins(session, communityId, channelId);
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
    this.invalidateChannelPins(session, communityId, channelId);
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

  public async createCommunityInvitation(
    session: Session,
    communityId: string,
    recipientIdentityId: string,
  ): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: null | string;
  }> {
    return await this.invitations.create(
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
    return await this.invitations.createInviteLink(session, communityId, input);
  }

  public async getCommunityInviteLink(
    inviteToken: string,
  ): Promise<CommunityInviteLinkResource> {
    return await this.invitations.getInviteLink(inviteToken);
  }

  public async acceptCommunityInviteLink(
    session: Session,
    inviteToken: string,
  ): Promise<Community> {
    return await this.invitations.acceptInviteLink(session, inviteToken);
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
    return await this.invitations.acceptInviteLinkWithKey(
      session,
      inviteToken,
      keyEntry,
    );
  }
}
